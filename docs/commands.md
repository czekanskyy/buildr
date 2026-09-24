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
export interface Command<T extends string = string, P = unknown> { readonly type: T; readonly payload: P }

export interface CommandHandler<C extends Command> {
  type: C['type'];
  schema?: z.ZodType<unknown>;                                   // payload shape, checked before validate
  validate(doc: BuilderDocument, cmd: C, env: HandlerEnv): Result<void, CommandError>;   // canInsert, locks
  apply(draft: Draft<BuilderDocument>, cmd: C, env: HandlerEnv): { affected: NodeId[]; select?: NodeId[] };
}
// HandlerEnv = { registry, generateId, index }  (index of the document *before* this command)
// CommandEnv  = { registry, commands: CommandRegistry, generateId, checkInvariants? }

export function createCommandRegistry(handlers): CommandRegistry;          // a value, not a global
export function execute(doc, cmd, env): Result<CommandResult, CommandError>;       // CommandResult = { doc, patches, inverse, affected, select }
export function executeBatch(doc, cmds, env): Result<CommandResult, CommandError>; // atomic: all-or-nothing, one inverse
export function canExecute(doc, cmd, env): Result<void, CommandError>;
export function replay(doc, commands, env): Result<{ doc, steps }, CommandError>;
export function parseCommand(commands, input: unknown): Result<Command, CommandError>;  // untrusted input
export function applyDocumentPatches(doc, patches: unknown[]): Result<BuilderDocument, CommandError>; // the canvas
```

- `executeBatch` runs the commands in order, each against the previous result (so a later `validate` sees the earlier changes); one failure returns `Err` with `commandIndex` and no document. Its `inverse` is the per-command inverses in reverse order, so one undo reverts the whole batch.
- A rejected command is an `Err` (`command.rejected` with the rule's user-facing `reason`, `command.invalid-payload`, `command.unknown-type`, `command.invariant-violated`), never an exception. `applyDocumentPatches` validates patches from `postMessage` (ops, path shape, no `__proto__`/`constructor`/`prototype` segments, at most 10 000).
- Immer is used only inside `core/commands`; `patches`/`inverse` are Immer's own, so undo correctness does not depend on hand-written inverses.
- `checkInvariants` (default on) runs `checkInvariants` on every result and rejects a command that leaves the document invalid; the editor turns it off in production. Cost at 5000 nodes: a command runs in about 2.5ms with the check off on an idle machine (the test allows 10ms for loaded CI).
- Commands are **serializable** JSON, enabling logging, replay, and golden/property-based tests.
- `generateId` is injected, so tests get deterministic snapshots via a seeded generator.
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

## `node.insert` details

Payload `{ parentId, slot, index, fragment }`; the fragment is always a `BuilderFragment` (a single component, a template's tree or pasted content). It is checked as untrusted input before `canInsert` decides placement:

- shape (`fragmentSchema`), and that it is a proper forest — every child exists, every node is reachable from a root exactly once (`command.invalid-fragment`);
- every type is registered and every used slot exists on its component (`unknown-component-type`, `slot-not-found`);
- its component versions agree with the document's (`command.component-version-mismatch`), and the document limits hold — nodes, depth, slot children (`command.limit-exceeded`);
- `canInsert` for every root: slot `allow`/`deny`/`max`, the component's own parent rules, the content model, `insertable`/`root`, structural locks and the index range. Its `Reason` message is passed through as the error `message`.

A fragment whose ids collide with nodes already in the document (a second paste) is given fresh ids from the injected `generateId`; otherwise its ids are kept. `doc.components` gains the fragment's versions, and the inserted roots become the selection.

## `node.remove` details

Payload `{ ids }`. A node listed together with one of its ancestors is redundant, not an error. Each top-level node must pass `canRemove` (root, `removable`, structural locks, slot `min`); siblings removed together are also checked together against the slot's `min`. Whole subtrees leave `doc.nodes` (no orphans); `doc.components` keeps its version entries. The selection moves to the neighbour that takes the first removed node's place (next sibling, else previous), else to the parent. `HandlerEnv.doc` gives `apply` the pre-command document.

## `node.move` details

Payload `{ ids, parentId, slot, index }`. `index` is the gap the user pointed at, as a position in the destination slot **as it is before the move** (`0..children.length`); when the nodes move within their own slot the handler corrects for them being taken out first, so dropping `A` before `D` in `[A, B, C, D]` is `index: 3`. `ids` must be siblings (same parent and slot; otherwise `command.move-not-siblings`), need not be contiguous, and keep their document order. Each node must pass `canMove` (not the root, draggable, current location not locked, destination rules and lock, no move into its own subtree) and together they must fit the destination's `max`. Dropping a node where it already is is a no-op (same document, no patches). Undo restores the exact position.

## `node.setProp` / `node.unsetProp` details

`node.setProp { id, prop, value, locale? }` — the `Value` is checked against the component's `PropDef`: a static value (and each of its `l10n` entries, and a fallback) by the prop kind's validator, a binding by path syntax (`parsePath`), an expression by its syntax (formula or `{{ }}` template). Bindings and expressions are only accepted on `bindable` props; translations only on `localizable` ones. An unknown prop is `command.unknown-prop`; content locks (`canEdit`) apply.

- **Without `locale`** the whole `Value` is replaced — this is also the only way to change the value's *kind* (static → binding → expression).
- **With `locale`** the write lands in `l10n[locale]` of the existing value: `value` must be a `static` value (its `value` is the translation) or a template-mode expression (its `expr` is the translation) of the same kind as the current value, without translations of its own. A binding or a formula cannot be translated (`command.not-translatable`), there must be a default-language value first (`command.no-base-value`), and a different kind is `command.value-kind-mismatch`. The command does not know the document's `LocaleConfig`: "the default language" is the call without `locale`, and whether `locale` is one of the configured languages is a validation-rule concern (an unknown `l10n` key is only a warning, per this document).
- `node.unsetProp { id, prop, locale? }` removes the prop (the component default applies again) or only that language's translation; empty `l10n`/`props` objects are dropped, and removing something absent is a no-op.
- **Coalescing**: both commands expose `mergeKey = prop:<id>:<prop>:<locale>` (`CommandHandler.mergeKey`) for the history manager.

## `node.setStyle` / `node.unsetStyle` / `node.resetStyles` details

`node.setStyle { id, layer, group, property, side?, value }` — `layer` is `{}` (desktop `base`), `{ bp }` or `{ state }` (never both; `"base"` is not a breakpoint id). The value goes through the property's grammar (`parseStyleValue`) and is stored as written, so tokens stay `$space.4`. Per-side (`spacing.margin`) and per-corner (`border.radius`) properties are set with `side`, or with an object that replaces the whole property. Pseudo-states only accept visual properties (`allowInStates`); a node may hold styles for at most 8 breakpoints; style locks (`canEdit` `'style'`) apply. Whether a `bp` id is one of the *theme's* breakpoints is not checked here (the command has no theme); the compiler reports `style.unknown-breakpoint`.

`node.unsetStyle` removes one property, or one side/corner, from a layer; `node.resetStyles { id, layer? }` clears one layer, or every layer when `layer` is omitted. Every operation prunes the empty objects it leaves behind (down to dropping `node.styles` itself), and removing something absent is a no-op. Coalescing key: `setStyle:<id>:<group>.<property>[.<side>]:<layer>` (`layer` = `base`, the breakpoint id, or `state:<name>`); `resetStyles` never merges.
