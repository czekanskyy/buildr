---
"@next-buildr/core": minor
---

Add the `node.remove` command (PB-033): removes nodes with their subtrees (root, `removable`, locks and slot `min` respected, also across siblings removed together), leaves no orphans and moves the selection to a neighbour or the parent. `HandlerEnv` now also carries the pre-command `doc`.
