---
'@buildr/payload': minor
---

Add the `@buildr/payload/mcp` subpath with `createPayloadMcpBackend` (PB-140): an `McpBackend` for `@buildr/mcp` over the builder API, authenticated with a Payload API key (contract-validated responses, timeouts, retries for GETs only, the key never in errors). `@buildr/mcp` is a new optional peer dependency.
