---
'@next-buildr/core': minor
---

PB-157: bump the canvas protocol to version 2 with strict, bounded overlay view updates, block action and insertion intents, and ping/pong message shapes. The editor remains the only document mutation owner. Editor and canvas (`@next-buildr/react`) must be updated together; version 1 peers are rejected through the existing protocol-mismatch path.

PB-157: the optional `typeLabels` (localized component names, at most 128, strictly bounded) and `scale` fields of `view:set` and the 14th overlay label `selectParentOf` are additive.
