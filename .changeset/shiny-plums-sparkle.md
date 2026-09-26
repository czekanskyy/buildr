---
"@next-buildr/core": minor
---

Add the authoring format, fragments, and `reId` (PB-010): `TreeNode`/`fromTree`/`toTree` convert between the nested authoring shape (templates, tests, seeds) and the normalized document; `BuilderFragment`/`fragmentSchema` is the transport format for the clipboard and template insertion; `extractFragment(doc, ids)` pulls one or more subtrees out of a document, and `reId(fragment, idGen)` mints fresh IDs for a fragment so it can be pasted more than once without collisions.
