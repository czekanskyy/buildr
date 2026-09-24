---
"@buildr/payload": minor
---

Payload document endpoints (PB-095): `GET /buildr/session`, `GET /buildr/manifest`, `GET`/`PUT /buildr/documents/:collection/:id` and `POST .../publish`, with revision conflicts (`409`), diagnostics (`422`), autosave and the a11y publish policy. The Zod contract is in `packages/payload/src/contract.ts`.
