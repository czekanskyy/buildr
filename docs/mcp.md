# MCP server: building pages with AI agents

> Status: the package scaffold, backend interface, server factory (PB-133) edit sessions (PB-134) and agent-facing serialization (PB-135) are implemented; the rest is skeleton. The decisions are recorded in [ADR-024](adr/ADR-024-mcp-server.md); the implementation lands in phase 14 ([backlog](backlog/phase-14-mcp-server.md)). Sections are filled in by the tasks named below.

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

`@buildr/mcp/testing` exports `runBackendContract({ name, create })`, the behavioural definition of a valid backend (vitest is an optional peer dependency; import this subpath from test files only). `create()` returns a fresh `BackendContractSubject` per test: the `backend`, an `existing` editable draft, a `missing` ref, a creatable `collection`, an `unknownCollection`, collections with and without a data schema, and optionally a `readOnlyBackend` and a `noPublishBackend` over the same store to enable the `forbidden` cases. The memory backend runs it in this package; the HTTP backend runs the same suite against a live Payload (SQLite) through a `fetch` bridged to Payload's request handler (`packages/payload/src/plugin/endpoints/mcp-http-backend.test.ts`); its retry, error-mapping and secret-hygiene behaviour is covered with a mock `fetch`.

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

### HTTP backend (`@buildr/payload/mcp`)

`createPayloadMcpBackend({ baseUrl, apiKey, collection?, collections?, theme?, siteUrl?, timeoutMs?, retries? })` implements `McpBackend` over the builder API (`contract.ts`) of a site whose plugin has `mcp.enabled`. `baseUrl` is Payload's API root (`https://example.com/api`), `apiKey` the key of the dedicated agent user and `collection` its auth collection (default `users`); the key is sent only as `Authorization: <collection> API-Key <key>`.

- Every response is parsed with the contract schemas; documents with `parseDocument`. `save` parses the document before sending. Statuses map to errors: `401`/`403` -> `forbidden`, `404` -> `not-found`, `409` -> `conflict` (with `currentRevision`), `422`/`400` -> `invalid`, `429`/`5xx`/no answer -> `network` (`retryable`), an answer that breaks the contract -> non-retryable `network`.
- Timeouts (default 15 s). Only `GET`s are retried (network errors, `429`, `502`-`504`; exponential backoff, `retries` default 2); writes are never retried.
- The API key never appears in a URL, an error message or a diagnostic: every message is scrubbed of it, and the cause of a failed `fetch` is dropped.
- The builder API has no collection index, no theme endpoint and a fixed page size of 20, so: `listDocuments` without a `collection` lists the `collections` option (and is refused as `invalid` without it); `limit`/`page` are mapped onto the server pages and `total` is exact; a `status` filter or several collections fetch up to 500 documents per collection; `getTheme()` returns the `theme` option (default theme); `previewUrl` prefixes the document's `previewPath` with the origin of `baseUrl` (or `siteUrl`); a site without a media collection lists no media.

### Memory backend

`createMemoryBackend({ manifest, theme?, documents?, collections?, session?, dataSchemas?, media?, previewBaseUrl?, now? })` implements the whole contract in memory (revisions, conflicts, permissions, `parseDocument` with the session limits). The default session may edit and publish; override `session.permissions`. Used for tests and the `--playground` mode of the CLI (PB-141). `now` is injectable for deterministic timestamps.

## The server

```ts
import { createBuildrMcpServer } from '@buildr/mcp';

const server = createBuildrMcpServer({ backend, options: { allowPublish: false } });
await server.connect(transport); // stdio, Streamable HTTP, or an in-memory pair in tests
```

`createBuildrMcpServer` returns an MCP SDK `Server` with server info (`buildr`, the package version), the `tools` capability and the instructions string (`DEFAULT_INSTRUCTIONS`, replaceable via `options.instructions`). It serves the tools passed as `options.tools` (an `McpTool`: name, description, JSON Schema input, annotations, `handler(args, { backend, options })`); the built-in tools are added by PB-136 - PB-138. `options.resources` (an `McpResources`: `templates`, `list`, `read`; SDK-free) enables the `resources` capability. A throwing handler yields a generic error result, never its message. The host owns the transport.

## Edit sessions

An agent never edits the backend's document directly: it edits a **working copy** held in an `EditSession` (ADR-024, decision 5) and saves it explicitly with `baseRevision`. A session is the editor store without React: `load()` + `createRegistryMeta(manifest)` + core's history.

```ts
import { createSessionStore } from '@buildr/mcp';

const sessions = createSessionStore({ backend }); // ttlMs, maxSessionsPerUser, manifestCheckIntervalMs, now
const opened = await sessions.open({ collection: 'pages', id: '1' }, { locale: 'de' }); // or sessions.create({ collection, title, slug? })
if (!opened.ok) return opened.error; // SessionError: { code, message, command?, backend?, details? }

const session = opened.value;
const changed = session.apply([insertCommand, setPropCommand], { label: 'add hero' }); // atomic (executeBatch), one undo step
session.undo(); session.redo();
session.dirty; // history cursor !== the cursor at load/save, so it is right after undo/redo
const saved = await backend.save(session.ref, session.doc, session.revision);
if (saved.ok) session.markSaved(saved.value); // new base revision, current state is clean
sessions.close(session.id); // refuses a dirty session unless { discard: true }
```

| Guarantee | How |
|---|---|
| Only commands change the document | `apply` is `executeBatch`; `undo`/`redo` replay history patches; `session.doc` is deeply frozen |
| Atomic | a rejected command (`command-rejected`, with the core `CommandError` incl. `commandIndex`) leaves document and history untouched |
| Limits | a batch holds at most 500 commands; a change that grows the document past `getSession().limits` (`maxNodes`, `maxBytes`) is refused (`limit-exceeded`), while removals stay possible |
| Read-only | a document that is `readOnly`, or an agent user without `canEdit`, opens read-only; `apply` returns `read-only` |
| TTL | 30 minutes idle by default; every `get` refreshes; expired sessions (unsaved changes included) are dropped lazily, there are no timers; the error says to open the document again |
| Cap | 5 open sessions per backend user by default; the next `open` is `session-limit` (nothing is evicted) |
| Manifest pin | the manifest hash is recorded at open; `get` re-checks it at most every `manifestCheckIntervalMs` (60 s) and answers `manifest-changed` (reopen). `get(id, { ignoreManifest: true })` still reaches the session, e.g. to close it |

Errors are the `SessionErrorCode`s in `packages/mcp/src/session/errors.ts`; a backend failure is `backend` with the typed `McpError` attached (`conflict`, `forbidden`, ...). The tools in PB-137/PB-138 are thin wrappers over this API.

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

## Serialization (agent-facing)

Everything an agent reads or writes goes through `packages/mcp/src/serialize` (PB-135), exported from `@buildr/mcp`. The tools (PB-136 - PB-138) only compose these functions.

| Function | Purpose |
|---|---|
| `renderOutline(doc, registry, opts)` / `outlineToJson` / `buildOutline` | Compact tree: `id type "name" "text" [l10n:..] [locked:..] [hidden] [if] [tpl:..]`, one line per node. Options: `nodeId` (zoom), `depth` (default 3), `maxNodes` (500), `maxChars` (30000), `locale`. Deeper or cut content is summarised as `(+N more)` / "output cut after N of M nodes", so a 1000-node page stays under 40k characters at depth 3. |
| `describeNode` / `formatNodeDetail` | One node: every prop as a `Value` (plus the component default), styles per layer, attributes, lock, region, template origin, parent and slots. |
| `describeComponent` / `formatComponentDescription` | Props schema, slots and what they allow, parent rules, style groups, a11y notes, a minimal valid example tree and where it can be inserted (`placement`). |
| `parseTreeInput(registry, input)` | Validates an agent-written tree and returns the core `TreeNode` for `fromTree`. Reports every problem at once with valid alternatives (unknown type or prop or slot, "did you mean"). |
| `createTreeInputSchema` / `treeInputJsonSchema` / `treeInputDefs` / `TREE_NODE_REF` | The described Zod schema and its JSON Schema (object root, recursion through `$defs.TreeNode`) for tool `inputSchema`s. |
| `explainReason` / `explainCommandError` / `explainSessionError` / `formatAgentError` | Turn a core `Reason`, command error or session error into one sentence plus the nearest valid alternatives. Every `ReasonCode` and `command.*` code has an explainer (tests enforce it). |
| `acceptsChild` / `allowedChildTypes` / `allowedParents` | "What can go where" from the registry. |

Tree input accepts a plain JSON prop value as shorthand for a static `Value` (`{ "text": "Hi" }`); bindings and expressions use the full `{ kind: 'binding' | 'expression' }` form. `children` fills the default slot, `slots` names slots explicitly (not both). Components with `insertable: false` (list-item, accordion-item) are valid inside a tree but cannot be inserted alone: duplicate an existing one, or insert the parent tree.

### Test fixture

`@buildr/mcp` must not depend on `@buildr/components` (ADR-024), yet the snapshot tests cover every built-in component. The default manifest is committed as `packages/mcp/fixtures/default-manifest.json` and read by the test kit; `packages/components/src/mcp-manifest-fixture.test.ts` fails when it is stale. Regenerate with `UPDATE_MCP_FIXTURE=1 pnpm test --filter @buildr/components`.

## Discovery tools and resources

`createDiscoveryTools(cache?)` returns the read-only tools an agent uses to learn what it can build (all `readOnlyHint: true`): `list_components` (grouped by category, one line each), `describe_component`, `list_templates`, `describe_template` (outline of the instantiated fragment, optional `variant`), `get_style_reference` (where styles live, the value grammar per property, theme tokens, breakpoints; optional `group`), `get_data_schema` and `list_media` (alt texts are labelled as data). Components and templates come from the backend manifest, so custom ones are discoverable without any extra backend method.

`createResources(cache?)` serves the same text as MCP resources: `buildr://components/{type}`, `buildr://templates/{id}` (every component and template is also listed) and `buildr://style-reference`. Pass one `createDiscoveryCache()` to both: rendered answers are cached per manifest hash and rebuilt when the manifest changes.

```ts
const cache = createDiscoveryCache();
createBuildrMcpServer({
  backend,
  options: { tools: createDiscoveryTools(cache), resources: createResources(cache) },
});
```

## Tool reference

To be generated from the tool definitions (PB-144).

## Publishing

Disabled by default. Requires the plugin option `mcp.allowPublish`, the user's `canPublish` and `confirm: true`; `publishPolicy: block` is respected (ADR-024, decision 5).

## Security notes

- Content read from the CMS is data, not instructions.
- Use a least-privilege agent user and rotate its key.
- The API key is read from `BUILDR_API_KEY`, never from a flag.
