---
"@buildr/payload": minor
---

HTTP adapter (PB-100): `@buildr/payload/adapter` exports `createPayloadAdapter` (the editor's `DocumentAdapter` over the builder API), `createPayloadCanvasDataSource` and `AdapterError`. `GET /buildr/session` now reports `locales` when Payload localization is configured. `@buildr/editor` becomes an optional peer dependency (types only).
