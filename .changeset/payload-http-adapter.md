---
"@next-buildr/payload": minor
---

HTTP adapter (PB-100): `@next-buildr/payload/adapter` exports `createPayloadAdapter` (the editor's `DocumentAdapter` over the builder API), `createPayloadCanvasDataSource` and `AdapterError`. `GET /buildr/session` now reports `locales` when Payload localization is configured. `@next-buildr/editor` becomes an optional peer dependency (types only).
