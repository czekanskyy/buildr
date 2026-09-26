---
"@next-buildr/core": minor
---

Add the `node.insert` command (PB-032) and `coreCommandHandlers`: inserts a validated fragment (components, templates, pasted content) into a slot at an index, re-ids on collision, records component versions, selects the inserted roots, and rejects with the `canInsert` `Reason` message.
