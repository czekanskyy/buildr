---
'@next-buildr/payload': minor
---

Add the `@next-buildr/payload/mcp` subpath with `createPayloadMcpBackend` (PB-140): an `McpBackend` for `@next-buildr/mcp` over the builder API, authenticated with a Payload API key (contract-validated responses, timeouts, retries for GETs only, the key never in errors). `@next-buildr/mcp` is a new optional peer dependency.
