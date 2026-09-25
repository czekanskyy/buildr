---
"@buildr/payload": minor
---

Add `GET /api/buildr/documents/:collection/:id/revision` (PB-143): the revision, `updatedAt` and, with `mcp.enabled`, the name of the user who saved last (`buildrUpdatedBy`), without loading the document. `createPayloadAdapter` implements the editor's `getRevision` with it.
