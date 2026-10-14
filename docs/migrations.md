# Migrations

See also [ADR-014](adr/ADR-014-schema-migrations.md).

Buildr tracks two independent version axes, both **forward-only**:

1. **Document schema version** (`BuilderDocument.schemaVersion`) — the shape of the document itself (e.g. a new top-level field, a change to how slots are represented).
2. **Component version** (`BuilderDocument.components[type]`) — a single component's prop schema (e.g. renaming a prop, changing a `default`, splitting one prop into two).

## Rules

- Migrations only ever move forward: `from -> to`. There is no "downgrade" path.
- A released migration is **immutable**. A bug found in a shipped migration is fixed by adding a *new* migration step on top of it, never by editing the old one — this preserves reproducibility for every document ever written against it.
- Migrations run **at write time** (the result is persisted) and, transparently, **at read time in memory** (not persisted) — so a document stored under an older schema always renders correctly even before its next save.
- A document whose component version is *newer* than what the running registry declares becomes **read-only** in the editor rather than being silently downgraded or corrupted.
- Every migration ships with a fixture: a "before" document at version N and the expected "after" document at version N+1 (or at the latest version, for the full-chain test), committed under `fixtures/migrations/`.

## Document migrations

```ts
export interface DocumentMigration { from: number; to: number; migrate: (doc: RawDocument) => RawDocument }
```

Located in `packages/core/src/migrations/document`. `migrateDocument(raw)` walks the chain from the document's stored `schemaVersion` to `CURRENT_SCHEMA_VERSION`, returning a `Result`. A stored version newer than `CURRENT_SCHEMA_VERSION` is rejected with `document.newer-version`.

## Component migrations

Live alongside each component's own definition (`migrations: { 2: (props) => ({ ...props, size: props.level }) }` in the `defineComponent` call). `migrateComponents(doc, migrations)` walks the document once, migrating each node's props according to `doc.components[node.type]`, and updates the `components` version map. An unknown component type is left untouched, with a diagnostic. Migration context only ever has access to the node's own subtree — never the whole document — keeping migrations composable and easy to reason about.

## Replacement migrations

A third kind of component migration retires a component type by turning its nodes into nodes of another type ([ADR-025](adr/ADR-025-retiring-a-component-type.md)). The component that takes over declares it:

```ts
defineComponent({
  type: 'buildr/container',
  // ...
  replaces: {
    'buildr/stack': {
      fromVersion: 1, // the retired type's last stored version
      toVersion: 2,   // the version of THIS type the result is written at
      migrate: ({ props, styles }) => ({ props: { display: s('flex'), width: s('none'), ...props }, styles }),
    },
  },
})
```

`migrate` is pure and receives and returns `{ props, styles }`, so it can also set a style default to keep the old look. After it runs, the replacing type's normal steps run from `toVersion` to the current version.

Rules:

- **Atomic per group.** A group is a registered type plus every retired type that targets it. The plan is made from the original document before anything changes. If any check fails, no node of the group is touched and no version changes.
- **Order does not matter.** Every node is migrated from its original version and subtree. Nodes rewritten from a retired type do not pass through the replacing type's earlier steps.
- **Types are found in the nodes**, not only in `doc.components`. A missing version counts as `fromVersion` for a retired type.
- **After a successful run** the retired type is removed from `components`, the replacing type is at the current version, and an unchanged document is returned as the same reference.
- **Failure makes the document read-only**, it is never an error that drops content. `readOnlyReasons` gets `component.replacement-version-mismatch` when a retired type is stored at a version other than `fromVersion`, `component.missing-version` when the replacing type has nodes but no stored version, or the existing newer-version or broken-chain code when the replacing type's chain does not resolve. Diagnostics stay at `warning`; read-only is signalled by the reasons list.
- `createRegistry` throws when two components retire the same type, or when a retired type is still registered.

Fragments (clipboard content, templates) are migrated with `migrateFragment(fragment, migrations)`, which applies the same rules to `{ components, nodes, roots }` and returns `{ fragment, readOnlyReasons, diagnostics }`. New fragments built by `fromTree` or `instantiateTemplate` must be stamped with the registry's versions (`registryVersions(meta)`), otherwise they carry version 1 and are migrated or rejected.

The result is **one-way**: save, publish and template hooks persist the migrated document, and an older build opens it read-only. Keep Payload versions enabled so a pre-migration revision can be restored.

## The chain runner

`runMigrationChain(input, fromVersion, toVersion, steps)` (`packages/core/src/migrations/runner.ts`) is the generic engine both migration kinds are built on: it walks `steps` one `from -> to` hop at a time, applying each matching step's `migrate`, until `toVersion` is reached. A run that starts and ends at the same version applies nothing (`applied: []`) and returns the input untouched. It rejects (rather than looping or silently truncating) when `fromVersion` is already newer than `toVersion`, when no registered step starts at the current version, when a step doesn't move the version forward, or when a step overshoots the target.

`migrateDocument` (`packages/core/src/migrations/document/index.ts`) wires this runner up for the document shape: it rejects a `schemaVersion` newer than `CURRENT_SCHEMA_VERSION` with `document.newer-version` before ever calling the runner, then delegates the rest to `documentMigrations`. As of PB-011, `CURRENT_SCHEMA_VERSION` is still `1` and `documentMigrations` is empty — every document is already current, so `migrateDocument` is a no-op until the schema's first version bump ships a step here.

`documentMigrationFixtures`, the fixture corpus this section's "every migration ships with a fixture" rule requires, lives at `packages/test-utils/src/fixtures/migrations` and is exercised by that directory's own "fixture vN -> latest" test harness. It's empty for the same reason.

## Writing a migration

1. Add a fixture pair (before/after) to the relevant `fixtures/migrations/` directory.
2. Write the migration function — pure, deterministic, and scoped to exactly the `from`/`to` step.
3. Register it in the migration chain (document) or the component's `migrations` map (or, to retire a type, the replacing component's `replaces` map).
4. Run the full-chain test harness ("fixture vN -> latest") to confirm no other version's fixtures regressed.
5. Update the changeset and, if the change affects authoring, the relevant `docs/` page.

See [AGENTS.md](../AGENTS.md) for the corresponding MUST/MUST NOT rules, and [ai/testing-rules.md](ai/testing-rules.md) for the required test coverage.
