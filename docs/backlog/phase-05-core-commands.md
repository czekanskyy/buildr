# Phase 5: Core, commands, history, validation, accessibility, drag-and-drop

## PB-031 - The command framework - L

- **Purpose**: the only path for document mutation (see ADR-013).
- **Dependencies**: PB-009, PB-016
- **Files**: `packages/core/src/commands/{types,execute,registry,errors,replay,apply-patches}.ts`
- **Implementation**: `CommandHandler`, `execute`/`executeBatch`/`canExecute` (Immer `produceWithPatches`), `CommandEnv`, `CommandError`, dev-mode invariant checks, `commandSchema` (Zod), `replay`, `applyDocumentPatches` (for the canvas).
- **Tests**: test commands (no-op, failing): batch atomicity, correct patches and inverses, input immutability.
- **Acceptance criteria**: under 5ms per command at 5000 nodes.
- **Risks**: Immer performance — verified by benchmark.

## PB-032 - `node.insert` - M

- **Purpose**: inserting components, templates, and pasted content.
- **Dependencies**: PB-031, PB-010
- **Files**: `packages/core/src/commands/handlers/insert.ts`
- **Implementation**: fragment validation (schema, invariants, limits), `canInsert` for every root, `reId` on collision, updating `doc.components`, `select` = the inserted roots.
- **Tests**: an empty slot, a specific index, the end of a slot, forbidden targets, `slot.max`, locks, undo.
- **Acceptance criteria**: a rejection carries a `Reason` message.
- **Risks**: none.

## PB-033 - `node.remove` - S

- **Purpose**: removing subtrees.
- **Dependencies**: PB-031
- **Files**: `packages/core/src/commands/handlers/remove.ts`
- **Implementation**: removing whole subtrees from the map, protecting root, respecting `removable` and locks, selection moves to a sibling or the parent.
- **Tests**: no orphans remain; undo restores an identical document.
- **Acceptance criteria**: invariants hold.
- **Risks**: none.

## PB-034 - `node.move` - M

- **Purpose**: moving within a slot and across containers.
- **Dependencies**: PB-031
- **Files**: `packages/core/src/commands/handlers/move.ts`
- **Implementation**: `canMove`, cycle prevention, index correction within the same slot, moving multiple contiguous-sibling IDs at once.
- **Tests**: moving up and down (off-by-one cases), moving across containers, moving into a descendant (an error).
- **Acceptance criteria**: undo restores position exactly.
- **Risks**: index-arithmetic bugs — covered by the property-based tests in PB-040.

## PB-035 - `node.setProp` / `node.unsetProp` - S

- **Purpose**: editing props and bindings.
- **Dependencies**: PB-031, PB-013
- **Files**: `packages/core/src/commands/handlers/props.ts`
- **Implementation**: `Value` validation against `PropDef` (static: the kind's own validator; binding/expression: syntax); a `locale` parameter (writes to `l10n[locale]` for `localizable` props; changing the value *kind* is only allowed in the default locale); `mergeKey = prop:<id>:<prop>:<locale>`; content locks.
- **Tests**: valid and invalid values, writing and removing a translation, attempting to translate a binding (rejected), locks, coalescing.
- **Acceptance criteria**: an unknown prop is rejected.
- **Risks**: none.

## PB-036 - `node.setStyle` / `unsetStyle` / `resetStyles` - M

- **Purpose**: editing styles per breakpoint.
- **Dependencies**: PB-031, PB-027
- **Files**: `packages/core/src/commands/handlers/styles.ts`
- **Implementation**: a `{ layer: { bp?, state? }, group, property }` path, grammar validation, cleanup of empty objects, `mergeKey`, style locks.
- **Tests**: setting and unsetting per breakpoint, resetting a whole node or layer.
- **Acceptance criteria**: no empty `{}` objects remain after any operation.
- **Risks**: none.

## PB-037 - `node.duplicate` / `node.wrap` / `node.unwrap` - M

- **Purpose**: compound structural operations.
- **Dependencies**: PB-032, PB-033, PB-034
- **Files**: `packages/core/src/commands/handlers/{duplicate,wrap,unwrap}.ts`
- **Implementation**: duplicate = extract + `reId` + insert after the original; wrap (contiguous siblings, `canInsert` checked for both the wrapper and its children); unwrap (the `default` slot's children take the node's place, validated).
- **Tests**: each operation plus undo, plus forbidden cases.
- **Acceptance criteria**: one history entry per operation.
- **Risks**: none.

## PB-038 - `node.setAttr` - S

- **Purpose**: name, anchor, lock, region, `visibleIf`.
- **Dependencies**: PB-031
- **Files**: `packages/core/src/commands/handlers/attrs.ts`
- **Implementation**: validation (`name` <= 80 chars, an anchor pattern plus uniqueness check, a `canUnlock` permission check in `env` for removing locks).
- **Tests**: a duplicate anchor, insufficient permissions.
- **Acceptance criteria**: errors carry codes.
- **Risks**: none.

## PB-039 - The history manager - L

- **Purpose**: undo/redo, transactions, coalescing (see `docs/commands.md`).
- **Dependencies**: PB-031
- **Files**: `packages/core/src/commands/history.ts`
- **Implementation**: the `HistoryManager` interface, `createHistory({ limit, clock })`, `record`, `undo`, `redo`, `begin`/`commit`/`rollback` for transactions, `mergeKey` plus an 800ms window (an injected clock), pre/post selection, `cursorId`.
- **Tests**: undo/redo sequences, a transaction that fails partway, coalescing with a fake clock, the entry-count limit.
- **Acceptance criteria**: `cursorId` is stable (required for dirty-state tracking).
- **Risks**: none.

## PB-040 - Property-based tests for commands and history - M

- **Purpose**: correctness guarantees over random command sequences.
- **Dependencies**: PB-032 through PB-039
- **Files**: `packages/core/src/commands/__property__/*.test.ts`, `packages/test-utils/src/arbitraries.ts`
- **Implementation**: fast-check arbitraries (documents, commands); properties: invariants hold, undo-all restores the original, redo-all restores the final state, batch atomicity; failing seeds are saved as permanent regression tests.
- **Tests**: at least 1000 runs in CI, 10,000 in nightly.
- **Acceptance criteria**: green; any bug found gets a pinned regression test.
- **Risks**: CI time — bounded by the run-count limit.

## PB-041 - `validateDocument` - M

- **Purpose**: aggregating every validation (server, editor, CI).
- **Dependencies**: PB-009, PB-016, PB-017, PB-024, PB-025, PB-027
- **Files**: `packages/core/src/validation/*.ts`
- **Implementation**: envelope, invariants, versions, per-component props (including `l10n` values and keys against `LocaleConfig`), styles, bindings and expressions against `DataSchema` (when available), nesting of existing structure, limits; `severity` plus `blocking`.
- **Tests**: an invalid-case corpus (every category).
- **Acceptance criteria**: validating 1000 nodes takes under 30ms.
- **Risks**: none.

## PB-042 - The accessibility validator and MVP rules - L

- **Purpose**: see `docs/accessibility.md`.
- **Dependencies**: PB-041
- **Files**: `packages/core/src/a11y/{run,types}.ts`, `a11y/rules/*.ts`
- **Implementation**: the rule framework, configuration (`expectH1`, `disabledRules`), the MVP rules plus `missing-translation` (info, per locale; every a11y rule such as `image-alt` runs per language), a `fix` command where the fix is unambiguous (e.g. `heading-order` adjusting `level`).
- **Tests**: every rule has a positive and a negative fixture.
- **Acceptance criteria**: zero false positives against the MVP templates.
- **Risks**: false positives — mitigated by `disabledRules` and by using `warning` severity where appropriate.

## PB-043 - `computeDropTarget` - M

- **Purpose**: the pure drag-and-drop algorithm (see `docs/drag-and-drop.md`).
- **Dependencies**: PB-016
- **Files**: `packages/core/src/dnd/{types,compute-drop-target}.ts`
- **Implementation**: `HitPath`, edge zones, axis detection (flex/grid/block), inside vs. before/after, walking up the hit path, `reason`.
- **Tests**: a tabular set against synthetic rects (vertical, horizontal, grid, an empty container, forbidden targets).
- **Acceptance criteria**: deterministic output, no DOM required.
- **Risks**: UX quality in dense layouts — tuned after E2E test feedback.
