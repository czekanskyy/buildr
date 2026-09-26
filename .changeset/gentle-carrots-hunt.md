---
"@next-buildr/core": minor
---

Add the document envelope (PB-007): `BuilderDocument`/`PageNode` types, `documentSchema` (Zod), `createEmptyDocument()`, and `parseDocument()` — validating shape, a configurable byte-size limit, and the rest of `DocumentLimits` (`maxNodes`, `maxDepth`, `maxSlotChildren`, `maxStringLength`), returning a `Result<BuilderDocument, Diagnostic[]>`.
