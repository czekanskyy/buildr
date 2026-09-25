---
'@buildr/payload': minor
'@buildr/mcp': minor
---

Add the remote MCP server (PB-142): `createBuildrMcpRoute({ payload, registry })` from `@buildr/payload/mcp/route` returns Next.js route handlers for the Streamable HTTP transport (stateless, API-key only, origin validation, rate limiting, disabled unless `mcp.enabled`) that run the `@buildr/mcp` tools against a local, in-process backend. `@buildr/mcp/testing` exports `runToolScenario`, one scripted scenario for every transport. `@modelcontextprotocol/sdk` is a new optional peer of `@buildr/payload`.
