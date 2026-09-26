---
"@next-buildr/core": minor
---

Add `node.duplicate`, `node.wrap` and `node.unwrap` (PB-037): fresh-id copies inserted after their originals (anchors dropped), wrapping contiguous siblings in a new node, and unwrapping a node into its `default` slot's children, each validated as a single placement and each a single history entry.
