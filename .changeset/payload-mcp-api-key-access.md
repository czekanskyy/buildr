---
"@next-buildr/payload": minor
---

Add API-key access for AI agents (PB-139, ADR-024): the plugin option `mcp: { enabled, allowPublish, collections?, rateLimit?, rateLimiter? }` (off by default; needs an auth collection with `auth.useAPIKey`), `GET/POST /api/buildr/documents` (list builder documents, create a draft), the contract schemas `documentListQuerySchema`, `documentListResponseSchema`, `documentSummarySchema`, `createDocumentRequestSchema` and `createDocumentResponseSchema`, a hidden `buildrUpdatedBy` field that records the acting user in the document and its versions, and a write rate limit for API-key requests. API-key requests are refused by the builder endpoints unless `mcp.enabled`, and cannot publish unless `mcp.allowPublish` (and `access.publish`) allow it.
