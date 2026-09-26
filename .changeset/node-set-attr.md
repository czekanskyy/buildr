---
"@next-buildr/core": minor
---

Add `node.setAttr` (PB-038) for `name`, `anchor` (pattern and uniqueness), `lock`, `region` and `visibleIf`, with coded errors. Weakening a lock is gated by the new optional `CommandEnv.canUnlock` (fails closed when absent).
