# ADR-012: Undo/redo model

**Status:** Accepted

## Context

Undo/redo must be correct for arbitrarily complex structural operations (move, wrap, unwrap, batch operations) without hand-writing and separately testing an "inverse" for every command.

## Options

1. **Full document snapshots per history entry** — correct and trivial to implement, but memory- and CPU-wasteful for large documents and frequent edits (e.g. dragging a style slider).
2. **Hand-written inverse operations per command** — error-prone; every new command needs a matching, separately-tested inverse.
3. **Immer patches**: each command execution produces `[nextDoc, patches, inversePatches]` via `produceWithPatches`; undo replays `inversePatches`, redo replays `patches`.

## Decision**

Use **Immer `produceWithPatches`**. Correctness follows from Immer's patch generation, not from manually maintained inverse logic. `HistoryManager` is defined as an interface (`record`, `undo`, `redo`, transactions, merge-key coalescing) so a future collaborative-editing backend (e.g. a Yjs `UndoManager`) can be substituted without touching the UI or the command layer.

## Consequences

- Undo/redo correctness is largely a consequence of the command/patch architecture rather than of hand-audited inverse code — still validated by property-based tests (`undo-all ⇒ original state`).
- Structural sharing (Immer) keeps unaffected subtrees referentially stable, which the editor's per-node memoization (`NodeView`) relies on directly.
- Multiplayer undo, when it arrives (post-1.0), swaps the `HistoryManager` implementation; it does not change the command layer or the UI.
