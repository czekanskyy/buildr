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

## Writing a migration

1. Add a fixture pair (before/after) to the relevant `fixtures/migrations/` directory.
2. Write the migration function — pure, deterministic, and scoped to exactly the `from`/`to` step.
3. Register it in the migration chain (document) or the component's `migrations` map.
4. Run the full-chain test harness ("fixture vN -> latest") to confirm no other version's fixtures regressed.
5. Update the changeset and, if the change affects authoring, the relevant `docs/` page.

See [AGENTS.md](../AGENTS.md) for the corresponding MUST/MUST NOT rules, and [ai/testing-rules.md](ai/testing-rules.md) for the required test coverage.
