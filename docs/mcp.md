# MCP server: building pages with AI agents

> Status: the package scaffold, backend interface and server factory are implemented (PB-133); the rest is skeleton. The decisions are recorded in [ADR-024](adr/ADR-024-mcp-server.md); the implementation lands in phase 14 ([backlog](backlog/phase-14-mcp-server.md)). Sections are filled in by the tasks named below.

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

Packages and boundaries: [ai/package-boundaries.md](ai/package-boundaries.md). `@buildr/mcp` depends only on `@buildr/core`, `@modelcontextprotocol/sdk` and `zod`; all SDK usage is isolated in `src/server.ts`.

## The backend interface

`McpBackend` (`@buildr/mcp`) is the seam between the tool layer and a CMS, the way `DocumentAdapter` is for the editor. Every method returns a `Promise<McpResult<T>>` (`Result` from core with a typed `McpError`); expected failures never throw.

| Method | Purpose |
|---|---|
| `getSession()` | agent user, `permissions` (`canEdit`, `canPublish`, `canUnlockTemplates`), document `limits`, site `locales` |
| `getManifest()` / `getTheme()` | the site's component manifest (custom components included) and theme |
| `listDocuments(query)` | `{ collection?, search?, status?, page, limit }` -> summaries (`ref`, `title`, `slug`, `status`, `updatedAt`, `revision`) |
| `createDocument(input)` | `{ collection, title, slug? }` -> a **draft** with an empty layout, revision 0 (never published; no deletion exists) |
| `load(ref, { locale })` | the draft as a parsed `BuilderDocument` plus `revision`, `contextRef`, `layoutSource`, `layoutRef`, `previewPath`, `readOnly?` |
| `save(ref, doc, baseRevision)` | persists the document as the new draft; a stale `baseRevision` writes nothing |
| `publish(ref, baseRevision)` | publishes the draft; needs `canPublish` |
| `getDataSchema(collection)` | scopes and entities bindings can use |
| `listMedia(query)` | `{ search?, type?, page }` -> `MediaAsset`s |
| `previewUrl(ref, locale)` | a URL to view the document, or `null` |

Errors are one of five codes: `conflict` (carries `currentRevision`), `invalid` (carries core `Diagnostic`s), `forbidden`, `not-found`, `network` (carries `retryable`). Rules for implementations:

- Input and output shapes are Zod schemas exported from `@buildr/mcp` (`documentRefSchema`, `sessionSchema`, `listDocumentsQuerySchema`, `createDocumentInputSchema`, ...); validate at the boundary. Documents pass `parseDocument`.
- The backend is the trust boundary: `save` and `publish` re-validate and check permissions regardless of what the tool layer did.
- A returned document is a copy; the backend never hands out references into its own store.
- Secrets (API keys) never appear in an error message.

### Backend contract tests

`@buildr/mcp/testing` exports `runBackendContract({ name, create })`, the behavioural definition of a valid backend (vitest is an optional peer dependency; import this subpath from test files only). `create()` returns a fresh `BackendContractSubject` per test: the `backend`, an `existing` editable draft, a `missing` ref, a creatable `collection`, an `unknownCollection`, collections with and without a data schema, and optionally a `readOnlyBackend` and a `noPublishBackend` over the same store to enable the `forbidden` cases. The memory backend runs it in this package; the HTTP backend (PB-140) runs the same suite against a mock `fetch`.

```ts
import { runBackendContract } from '@buildr/mcp/testing';

runBackendContract({
  name: 'my backend',
  async create() {
    return { backend, existing, missing, collection: 'pages', unknownCollection: 'nope', dataSchemaCollection: 'pages', noDataSchemaCollection: 'nope' };
  },
});
```

The same entry point exports `createTestManifest()` (page, section, heading) and `createTestMemoryBackend(overrides)` for tests of the tool layer.

### Memory backend

`createMemoryBackend({ manifest, theme?, documents?, collections?, session?, dataSchemas?, media?, previewBaseUrl?, now? })` implements the whole contract in memory (revisions, conflicts, permissions, `parseDocument` with the session limits). The default session may edit and publish; override `session.permissions`. Used for tests and the `--playground` mode of the CLI (PB-141). `now` is injectable for deterministic timestamps.

## The server

```ts
import { createBuildrMcpServer } from '@buildr/mcp';

const server = createBuildrMcpServer({ backend, options: { allowPublish: false } });
await server.connect(transport); // stdio, Streamable HTTP, or an in-memory pair in tests
```

`createBuildrMcpServer` returns an MCP SDK `Server` with server info (`buildr`, the package version), the `tools` capability and the instructions string (`DEFAULT_INSTRUCTIONS`, replaceable via `options.instructions`). It serves the tools passed as `options.tools` (an `McpTool`: name, description, JSON Schema input, annotations, `handler(args, { backend, options })`); the built-in tools are added by PB-136 - PB-138. A throwing handler yields a generic error result, never its message. The host owns the transport.

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
