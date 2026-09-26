# Editor state management

**Technology**: Zustand 5 (a vanilla store plus selectors, using `useSyncExternalStore`). It is small, works outside React (protocol handlers, autosave), ships a devtools middleware, and is a familiar pattern for agents. Document-mutation logic does **not** live in the store — it lives in `@next-buildr/core/commands`; the store only calls `execute()` and stores the result.

## Slices

| Slice | State | Notes |
|---|---|---|
| `document` | `doc`, `docVersion` (a monotonic counter), `readOnly`, `migratedOnLoad` | Derived (memoized on `doc.nodes` identity): `index`, `validation`, `a11yIssues` (debounced 300ms, idle) |
| `history` | `past: HistoryEntry[]`, `future: HistoryEntry[]`, `openTransaction?`, `cursorId` | 200-entry cap |
| `selection` | `selectedIds: NodeId[]`, `selectedInstance?`, `hoveredId`, `anchorId` (multi-select in v0.2) | Cleared for deleted nodes |
| `viewport` | `breakpoint`, `canvasWidth`, `zoom`, `mode: 'edit' \| 'preview'` | |
| `ui` | active panels, inspector tab, expanded tree nodes, dialogs, drag state | Not part of history |
| `persistence` | `status: 'clean' \| 'dirty' \| 'saving' \| 'error' \| 'conflict'`, `savedCursorId`, `revision`, `lastSavedAt`, `error` | |
| `canvas` | `status: 'loading' \| 'ready' \| 'error'`, `manifestMismatch`, `diagnostics` | |

**Dirty state**: `dirty = history.cursorId !== persistence.savedCursorId`. Undoing back to the saved state correctly returns to "clean". Migrating a document on load does not itself set dirty — the save happens on the user's first actual change.

## The store in code (`@next-buildr/editor`, PB-074)

`createEditorStore({ doc, registry, ... })` returns a vanilla Zustand store (`getState`, `subscribe`) with these actions; there is no other way to change the document:

- `dispatch(command, { label? })` runs `execute`, records the result in the history (`createHistory`; typing merges by the command's `mergeKey`), swaps the new document in and returns the `Result`. A failing command changes nothing. `dispatchBatch(commands)` is `executeBatch`: one undo step, all or nothing.
- `transaction(label, fn)`: everything dispatched inside `fn` is one undo step. Returning `false`, or throwing, rolls it back (the inverse patches are applied). Transactions do not nest.
- `undo()` / `redo()` apply the history's patches with `applyDocumentPatches` and restore the selection that went with the step.
- `replaceDocument(doc)` loads another document and starts the history over.
- `markSaved()` records `savedCursorId`; `selectIsDirty` is `cursorId !== savedCursorId`.
- `onChange(listener)` hears every change: `{ kind: 'patch', from, to, patches }` (the very patches the canvas applies as `doc:patch`) or `{ kind: 'set', doc, version }`. `docVersion` goes up by one per change, undo and redo included.
- A read-only store (`readOnly`) refuses every change with `editor.read-only`.

**Derived state**: `selectIndex(state)` builds the parent index lazily and keeps it per document; `state.validation` (`validateDocument` + `runA11y`, tagged with the `docVersion` it describes) is recomputed 300 ms after the last change (`validateNow()` runs it at once; `validationDelayMs: null` turns it off). Selectors: `selectNode`, `selectChildren`, `selectSelectedNode`; in React `useNode(id)`, `useNodeChildren`, `useSelectedNode`, `useIsDirty` under `<EditorStoreProvider>`, each re-rendering only when its part changes (Immer keeps untouched nodes identical).

## Autosave (state machine)

```
clean --change--> dirty --(debounce 2s | maxWait 20s)--> saving --200--> clean (or dirty, if changes happened meanwhile)
                                                          saving --409--> conflict  -> [Reload] [Overwrite] [Save as copy]
                                                          saving --network error--> error -> retry 2s / 5s / 15s, still dirty
```

Single-flight: never two concurrent saves; only the latest state is ever queued. `beforeunload` warns while state is `dirty` or `saving`. A local IndexedDB safety copy ships in v0.2.

**Selectors**: `useNode(id)`, `useSelectedNode()`, `useNodeChildren(id, slot)`, `useEffectiveStyle(id, bp)` — memoized and reference-comparing, which works because of Immer's structural sharing.

## Collaboration readiness (post-MVP, evaluated now)

| Future requirement | Does the model block it? | Reasoning / plan |
|---|---|---|
| Multiplayer / real-time | No | The normalized node map with random IDs maps close to 1:1 onto Yjs (`Y.Map` nodes, `Y.Map` props). Commands express intent by ID, not by path, so they translate to CRDT operations. Concurrent moves under a CRDT need a "parent + fractional index" representation — an internal collaboration-layer representation, projected losslessly to/from the canonical format Payload stores, with no change to the canonical AST itself. |
| Undo in multiplayer | Needs a different implementation | `HistoryManager` is an interface; the patch-based implementation is swapped for a per-user undo manager (e.g. Yjs's `UndoManager`) with no change to UI or commands. |
| Presence | No | Selection/hover is UI state, not document state — broadcasting `selectedIds` is enough. |
| Comments | No | Anchored to stable `NodeId`s, a separate `buildr-comments { docRef, nodeId, thread }` collection. |
| Locks | No | Soft, per-node locks live in a presence layer. The `lock` field in the AST serves a different purpose (template structure locking). |
| Storage | No | Payload keeps the snapshot. A collaboration backend (e.g. Hocuspocus or y-sweet) would hold the live document and persist through the same endpoints. |

See [ADR-012](adr/ADR-012-undo-redo.md) and [ADR-013](adr/ADR-013-command-system.md).
