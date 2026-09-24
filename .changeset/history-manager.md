---
"@buildr/core": minor
---

Add the history manager (PB-039): `createHistory({ limit, clock, mergeWindowMs })` with `record`, `undo`, `redo`, transactions (`begin` / `commit` / `rollback`), `mergeKey` coalescing inside an 800ms sliding window (injected clock), selection before/after and a stable `cursorId` for dirty tracking; plus `commandMergeKey`.
