# ADR-025: Retiring a component type

**Status:** Accepted (2026-10-13). Amends [ADR-014](ADR-014-schema-migrations.md): it adds a third kind of component migration, the replacement migration.

## Context

`buildr/section` and `buildr/stack` overlap with `buildr/container`. All three are a box that lays out children; a section adds a width limit, a background image and a landmark element, a stack adds a column with a gap. Authors have to choose between three components for one job, and the insert panel lists all of them. The decision is to keep a single `buildr/container` (new props: `display`, `as`, `width`, `bleed`, `backgroundImage`, `role`, `ariaLabel`) and remove the other two.

Removal is not just deleting code. Documents already stored contain `buildr/section` and `buildr/stack` nodes, and clipboard fragments, templates and agent working copies carry them too. ADR-014 only covers a type moving from one version of itself to the next; it has no way to turn a node of one type into a node of another. Today an unknown type renders as a diagnostic and the node is lost to the author.

Two facts of the current code shape the design:

- `fromTree` stamps every type at version 1, and `insert` rejects a fragment whose version differs from the document's (`command.component-version-mismatch`). A fragment built from a registry whose `container` is at version 2 would be rejected, or would silently record version 1 and migrate to the old behaviour.
- The editor holds only `RegistryMeta` (serializable), not executable migrations, and the MCP file and memory backends parse documents without running migrations.

## Options

1. **A document-level migration (`schemaVersion` 1 -> 2) in core** that rewrites `buildr/stack` and `buildr/section` nodes. Simple to locate, but core would hard-code component types (violating the registry-agnostic design of ADR-003), would rewrite documents of third-party registries that happen to use these type names, and would clash with the independent per-component version axis.
2. **Migrate inside the core `insert` command.** Catches clipboard and template inserts in one place, but command payloads are serializable and handlers only see `RegistryMeta`, so no executable migration is available there; it would also make a command's result depend on registry code.
3. **A component-declared replacement migration**, run by `migrateComponents` (and a fragment variant) outside the command system, with the registry the host already passes around. The retired type stays a registry concern: the component that absorbs it says so.

## Decision

Option 3.

**`replaces`.** A component definition may declare `replaces: { '<retired type>': { fromVersion, toVersion, migrate } }`. `migrate({ props, styles }, ctx)` returns the new `{ props, styles }` of the replacing node, written at `toVersion` of the replacing type. Styles are part of the signature because a replacement may need a style default (for example a gap) to preserve the old appearance. `createRegistry` merges the declarations into the registry's migrations and throws on a duplicate retired type or when a retired type is still registered.

**Group-atomic planning in `migrateComponents`.** A migration group is a registered type T plus every retired type whose replacement targets T. Planning reads only the original document and mutates nothing:

- T's own chain (stored version to current) must resolve, and T must not be stored newer than the registry;
- every retired type R in the group must be stored at exactly its `fromVersion`, and T's chain from `toVersion` to current must resolve.

If any check fails the whole group is left untouched: no node of T or R changes and no version changes. Otherwise every node is migrated from its original version and original subtree, so the order of nodes does not matter: T nodes run T's steps from their stored version, R nodes run `replace.migrate` and then T's steps from `toVersion`, and the node's type becomes T. Rewritten nodes never pass through T's own earlier steps. On commit, R is removed from `components` and T is set to the current version. Groups are independent, and unrelated types keep the existing per-type behaviour. Types are found by scanning `doc.nodes`, because a type may be absent from `components` (`validation.missing-component-version`); a missing version counts as `fromVersion` for a retired type. When nothing changes the same document reference is returned.

**Failure is read-only, not an error.** A failed group reports `readOnlyReasons` with `component.replacement-version-mismatch` (a retired type stored at an unexpected version), `component.missing-version` (the replacing type has nodes but no stored version while a retired type is present; groups without a retired type keep the old behaviour) or the existing `component.newer-than-registry` and `component.migration-chain-invalid` codes. The severity stays `warning`, like the other read-only codes. The editor and the Payload write hook already refuse to save a document with read-only reasons.

**`migrateFragment(fragment, migrations)`.** The same core applied to `{ components, nodes, roots }`, returning `{ fragment, readOnlyReasons, diagnostics }`. `migrateComponents` and `migrateFragment` share one internal implementation.

**Version stamping of new fragments from the registry.** `fromTree` and `instantiateTemplate` accept the registry versions (`versions[type] ?? 1`). A new core helper `registryVersions(meta)` derives them, and `withRegistryVersions` moves from the MCP package to core. The editor insert panel, drag-and-drop fragments, `computeDropTarget` and the MCP tools pass them. The test-utils `doc()` builder gets a `versions` option, and gallery fixtures use the registry's versions.

**Clipboard migration in the editor layer.** `EditorApp` takes an optional `migrations` prop (a core type, so editor boundaries hold) which the host passes from its registry. On paste, if a fragment's versions differ from the editor's registry or it contains an unknown type, the editor runs `migrateFragment` first, then re-ids and dispatches `node.insert`. Without the prop, or on failure, paste is refused with a message (`clipboard.outdated`); a fragment is never inserted partially. The core command stays unchanged.

**MCP backends take migrations.** `createMemoryBackend` and `createFileBackend` accept an optional `migrations`. On load they run `migrateDocument`, parse, then `migrateComponents`. Without migrations, a document whose `components` map differs from the manifest or that has a type the manifest lacks loads read-only with a reason; edits return the existing read-only error. The stdio CLI, which has only a manifest, therefore serves old documents read-only. The Payload backend reads through endpoints that already migrate on read.

## Consequences

- **The migration is one-way.** Write-time hooks (save, publish, template instantiation) persist the migrated document, so a stored document permanently loses `buildr/section` and `buildr/stack`. An older build, which still knows those types but sees `buildr/container` at version 2, opens such a document read-only (ADR-014). Keep Payload versions enabled so a pre-migration revision can be restored.
- Retiring a type is a breaking change of the component package (major) and needs a changeset that says so.
- Visual parity is a requirement, not a hope: each replacement is tested against fixtures, and every output must pass `validateDocument` and the accessibility checks against the new registry.
- Core stays free of component names. Third-party registries can retire their own types the same way.
- Registries must now supply their versions wherever they create fragments; forgetting to do so is caught by the gallery guard test and the `command.component-version-mismatch` rejection.
- Hosts that embed the editor must pass `migrations` to get paste migration; otherwise old clipboard content is refused with a clear message.
