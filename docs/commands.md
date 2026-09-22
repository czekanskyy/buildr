# Commands

See also [ADR-013](adr/ADR-013-command-system.md) and [ADR-012](adr/ADR-012-undo-redo.md).

## Command catalog

| Requirement | Command | Payload |
|---|---|---|
| Add a node | `node.insert` | `{ parentId, slot, index, fragment }` (a component, a template, or a paste) |
| Remove a node | `node.remove` | `{ ids }` (removes whole subtrees; the root is protected) |
| Move a node | `node.move` | `{ ids, parentId, slot, index }` (index-corrected within the same slot) |
| Update a prop / a binding | `node.setProp` / `node.unsetProp` | `{ id, prop, value: Value, locale? }` / `{ id, prop, locale? }` (see [i18n.md](i18n.md)) |
| Update a style | `node.setStyle` / `node.unsetStyle` / `node.resetStyles` | `{ id, layer: { bp?, state? }, group, property, value }` |
| Duplicate a node | `node.duplicate` | `{ ids }` (fresh IDs, inserted after the original) |
| Wrap | `node.wrap` | `{ ids, wrapper: { type, props? } }` (contiguous siblings) |
| Unwrap | `node.unwrap` | `{ id }` (the `default` slot's children take the node's place) |
| — | `node.setAttr` | `{ id, key: 'name' \| 'anchor' \| 'lock' \| 'region' \| 'visibleIf', value }` |
| — | `doc.replace` | Full document swap (load, resync, conflict resolution). **Outside history**, clears the history stack |

```ts
export interface CommandHandler<C extends Command> {
  type: C['type'];
  validate(doc: BuilderDocument, cmd: C, env: CommandEnv): Result<void, CommandError>;   // canInsert, locks, schemas
  apply(draft: Draft<BuilderDocument>, cmd: C, env: CommandEnv): { affected: NodeId[]; select?: NodeId[] };
}
export interface CommandEnv { registry: RegistryMeta; generateId(): NodeId; index: DocumentIndex }
export function execute(doc, cmd, env): Result<CommandResult, CommandError>;       // CommandResult = { doc, patches, inverse, affected, select }
export function executeBatch(doc, cmds, env): Result<CommandResult, CommandError>; // atomic: one draft, all-or-nothing
export function canExecute(doc, cmd, env): Result<void, CommandError>;
```

- Commands are **serializable** JSON, enabling logging, replay, and golden/property-based tests.
- `generateId` is injected, so tests get deterministic snapshots via a seeded generator.
- `assertDocumentInvariants` runs after every command in dev/test builds.
- **Debug**: a ring buffer of the last 500 commands in the editor's dev panel, plus `replay(doc, commands)`. A user can optionally attach the log to a bug report.

## Undo/redo, transactions, batching

```ts
interface HistoryEntry {
  id: string; label: string;
  commands: Command[]; patches: Patch[]; inverse: Patch[];
  selectionBefore: NodeId[]; selectionAfter: NodeId[];
  mergeKey?: string; timestamp: number;
}
```

- **Undo** applies `inverse`; **redo** re-applies `patches`. Correctness follows from Immer's own patch generation, not from hand-written inverses. Selection is restored alongside the document state.
- **Transactions**: `store.transaction(label, (tx) => { tx.dispatch(a); tx.dispatch(b) })` produces a single history entry. A failure in any command rolls back the entire transaction.
- **Coalescing**: consecutive commands sharing a `mergeKey` (e.g. `setStyle:<id>:spacing.padding.top:mobile`) within an 800ms window merge into one entry — dragging a slider or typing in a field produces a single undo step.
- **Batching to the canvas**: patches are aggregated once per animation frame.
- A new command issued after an undo clears `future`. `doc.replace` clears the entire history.

See [drag-and-drop.md](drag-and-drop.md) for how commands are produced from pointer interactions, and [state-management.md](state-management.md) for how the store wires commands to persistence.
