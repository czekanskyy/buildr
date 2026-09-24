---
"@buildr/payload": minor
---

Payload validation and migration hooks (PB-094): every write of `layout` is migrated, limit-checked and validated (`processLayout`, `describeDiagnostics`, `documentLimits`); invalid documents are rejected with a field error on `layout`; new documents start with an empty layout. The `registry` option now takes `{ meta, migrations? }` (`BuildrRegistry`).
