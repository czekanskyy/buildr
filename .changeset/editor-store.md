---
"@next-buildr/editor": minor
---

The editor store (PB-074): `createEditorStore` — a vanilla Zustand store whose document changes only through `@next-buildr/core/commands` (`dispatch`, `dispatchBatch`, `transaction`, `undo`, `redo`), a patch emitter for the canvas host, dirty tracking, debounced validation and memoized selectors with React hooks.
