---
"@buildr/react": minor
---

Canvas data: `createDataPreparer` / `dataKey` re-run `prepareRender` only when the media or query specs (or locale, context) change, debounced 300 ms and cached by spec; `CanvasRuntime` gains `loadScopes`, and `dataLoading` in the store (PB-071).
