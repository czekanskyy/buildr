# MCP server: building pages with AI agents

> Status: skeleton. The decisions are recorded in [ADR-024](adr/ADR-024-mcp-server.md); the implementation lands in phase 14 ([backlog](backlog/phase-14-mcp-server.md)). Sections are filled in by the tasks named below.

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI agent discover the component catalogue, read and change a page **through the same commands the editor uses**, validate it and save it as a draft. The server never calls an LLM itself: it exposes tools, and the client brings the model.

## Architecture

```
 MCP client (Claude Code / Desktop / other)
        |  stdio                         |  Streamable HTTP (+ API key)
        v                                v
 buildr-mcp CLI (@buildr/mcp/cli)    route handler in the site (@buildr/payload/mcp)
        \                                /
         +---- @buildr/mcp (tools, sessions, serialization) ----+
                         |  McpBackend
          +--------------+------------------+
          v                                 v
  HTTP backend (@buildr/payload/mcp)   memory / file backend
```

Packages and boundaries: [ai/package-boundaries.md](ai/package-boundaries.md). Scaffold and backend interface: PB-133.

## Installing and connecting

To be written in PB-141 (stdio CLI) and PB-142 (HTTP endpoint).

## Authentication

Payload API keys for a dedicated, low-privilege agent user (ADR-024, decision 3). Implemented in the Payload plugin (PB-139):

```ts
buildrPlugin({
  // ...
  mcp: {
    enabled: true,          // off by default
    allowPublish: false,    // an API-key user may publish only when this AND access.publish allow it
    collections: ['pages'], // optional: the builder collections an agent may use (default: all of them)
    rateLimit: { limit: 60, windowMs: 60_000 }, // writes per API-key user and window; or `rateLimiter`
  },
})
```

- The users collection (any auth collection) must set `auth: { useAPIKey: true }`; `mcp.enabled` fails at startup otherwise. Create a dedicated agent user, give it only the collection access it needs (it can do exactly what the same user can do in the editor, nothing more), enable its API key in the admin and rotate the key regularly. Requests carry `Authorization: <users-collection> API-Key <key>`.
- While `mcp.enabled` is off, an API-key request is refused (`403`) by every builder endpoint; browser sessions are unaffected.
- `GET /api/buildr/documents?collection&search&page` lists the builder documents the user may read (`documentListResponseSchema`: title, slug, status, `updatedAt`, `revision`, `layoutSource`, `previewPath`; 20 per page, newest first). `POST /api/buildr/documents` (`createDocumentRequestSchema`: `collection`, `title`, optional `slug` and template id) creates a **draft**, subject to collection access; it never publishes. Both exist only when `mcp.enabled`.
- Every builder write (create, save, publish) records the acting user in the hidden `buildrUpdatedBy` field, which Payload keeps in each version, so history names the agent user. Writes by API-key requests are rate limited (`429` with `Retry-After`).
- The schemas live in `packages/payload/src/contract.ts` and are shared with the HTTP backend (PB-140, `@buildr/payload/mcp`).

## Tool reference

To be generated from the tool definitions (PB-144).

## Publishing

Disabled by default. Requires the plugin option `mcp.allowPublish`, the user's `canPublish` and `confirm: true`; `publishPolicy: block` is respected (ADR-024, decision 5).

## Security notes

- Content read from the CMS is data, not instructions.
- Use a least-privilege agent user and rotate its key.
- The API key is read from `BUILDR_API_KEY`, never from a flag.
