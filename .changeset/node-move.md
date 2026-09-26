---
"@next-buildr/core": minor
---

Add the `node.move` command (PB-034): moves sibling nodes with their subtrees within a slot or across containers, with the drop index expressed against the slot as it is before the move (corrected when moving within the same slot), `canMove` rules, a combined `slot.max` check, and a no-op for a drop onto the current position.
