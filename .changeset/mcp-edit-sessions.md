---
'@next-buildr/mcp': minor
---

Add edit sessions (PB-134): `createEditSession` and `createSessionStore` give an agent a headless, command-driven working copy of a document (`apply` via `executeBatch`, `undo`/`redo`, `dirty` from the history cursor, `markSaved`), with a per-store idle TTL (30 min), a per-user session cap (5), the backend's node/byte limits and a pinned manifest hash.
