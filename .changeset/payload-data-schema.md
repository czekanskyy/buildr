---
"@next-buildr/payload": minor
---

DataSchema and data context from Payload (PB-097): `@next-buildr/payload/data` exports `schemaFromCollection`, `buildContext`, `normalizeDoc` and `normalizeMedia`; new endpoints `GET /buildr/data-schema/:collection`, `GET /buildr/data/context` and `GET /buildr/samples/:collection`. Auth collections, hidden and credential-like fields never appear.
