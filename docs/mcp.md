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

`createBuildrMcpServer` returns an MCP SDK `Server` with server info (`buildr`, the package version), the `tools` capability and the instructions string (`DEFAULT_INSTRUCTIONS`, replaceable via `options.instructions`). It serves the tools passed as `options.tools` (an `McpTool`: name, description, JSON Schema input, annotations, `handler(args, { backend, options })`); the built-in tools come from `createBuildrTools` (below). `options.resources` (an `McpResources`: `templates`, `list`, `read`; SDK-free) enables the `resources` capability. A throwing handler yields a generic error result, never its message. The host owns the transport.

### One-liner for hosts

```ts
import { createBuildrMcpServerWithTools } from '@buildr/mcp';

const { server, store } = await createBuildrMcpServerWithTools({
  backend,
  options: { allowPublish: false }, // sessions?: { ttlMs, maxSessionsPerUser, ... }
});
await server.connect(transport);
```

It creates the session store, the complete tool list (`createBuildrTools`: discovery, documents, editing, quality, persistence) and the `buildr://` resources, and passes them to `createBuildrMcpServer`. An explicit `options.tools` / `options.resources` wins. The stdio CLI (PB-141) and the site's HTTP route (PB-142) use exactly this.

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

### Remote server (Streamable HTTP, `@buildr/payload/mcp/route`)

A site serves the same tools to remote clients (PB-142). Mount the route handler in the Next.js app:

```ts
// app/(builder)/api/buildr/mcp/route.ts
import { createBuildrMcpRoute } from '@buildr/payload/mcp/route';
import config from '@payload-config';
import { getPayload } from 'payload';
import { registry, theme } from '@/buildr.registry';

export const { POST, GET, DELETE } = createBuildrMcpRoute({
  payload: () => getPayload({ config }),
  registry,
  theme,
});
```

Point a client at `https://<site>/api/buildr/mcp` with the header `Authorization: users API-Key <key>`. The peers `@buildr/mcp` and `@modelcontextprotocol/sdk` must be installed.

- **Disabled by default**: the route answers `404` unless the plugin has `mcp.enabled` (it checks that the agent endpoints are registered). `publish` is offered only with `allowPublish: true` on the route, `mcp.allowPublish` on the plugin and `access.publish` for the user.
- **Authentication**: only `Authorization: <collection> API-Key <key>`, verified through Payload's API-key strategy. Cookies are never read: a request with only a session cookie (or a `JWT` header) is `401`, so a browser cannot drive the endpoint cross-site. Clients that fail to authenticate 30 times a minute (by `x-forwarded-for`) are answered `429` for the rest of the window.
- **Origin**: a request carrying a browser `Origin` must come from the site itself, Payload's `csrf` list or the `allowedOrigins` option, otherwise `403` (the transport spec's DNS-rebinding protection). MCP clients that are not web pages send no `Origin`.
- **Rate limiting**: 120 requests per user and minute (`rateLimit`, or `rateLimiter` for a shared store on serverless); the plugin's write limit applies on top. Bodies over 1 MB (`maxBodyBytes`) are `413`.
- **Local backend, no HTTP hop**: the tools run against `createPayloadMcpBackend` whose `fetch` answers from `handleEndpoints` of the same Payload, as the agent user. Payload's access control, the plugin's `access`, `mcp.collections`, the write limit, the revision checks and server-side validation therefore behave exactly as for the HTTP backend; `registry` serves the manifest when the plugin has none.
- **Stateless**: every `POST` is one JSON-RPC exchange on a fresh server (`enableJsonResponse`), so it works on serverless platforms; `GET` and `DELETE` are `405`. Open documents live in a per-user edit-session store in the route's closure (one per `createBuildrMcpRoute` call, never a global): a user's later requests, from any connection, continue the same working copies. On serverless the store lives as long as the instance; a session lost to a cold start is reported (`session-not-found`) and the agent reopens the document. Use one long-lived instance (or accept reopening) when agents work on long editing sessions.

#### One scenario over every transport

`runToolScenario(client, { collection, tree?, expectType?, expectText? })` from `@buildr/mcp/testing` is the shared test matrix: it lists the tools, creates a draft, inserts a tree, checks the outline, validates, saves, closes, reopens the document to prove the save reached the backend and returns `{ ref, revision }`. It takes any connected SDK `Client`, so PB-145 runs it over stdio, and `mcp-route.test.ts` over Streamable HTTP against a live Payload (SQLite). `scenario.test.ts` runs it over the in-memory transport.

## Installing and connecting

To be written in PB-141 (stdio CLI) and PB-144 (guide); the HTTP endpoint is described under "Remote server" above.

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

The full reference is generated from the tool definitions (PB-144). Document and editing tools (PB-137) are built by two factories that close over one `SessionStore`:

```ts
const store = createSessionStore({ backend });
const tools = [...createDocumentTools({ store }), ...createEditingTools({ store })];
const server = createBuildrMcpServer({ backend, options: { tools } });
```

| Tool | Purpose |
|---|---|
| `list_documents` | Documents the user can edit (collection, id, title, slug, status, revision); read-only |
| `create_document` | New **draft** in a collection, optionally seeded with a template; opens it and returns `sessionId`. The template is checked before anything is created |
| `open_document` | Working copy: `sessionId`, revision, `layoutSource`, outline; notes read-only and shared layouts |
| `get_outline`, `get_node` | Read the working copy (outline text or JSON, one node in full); read-only |
| `close_document` | Frees the session; refuses unsaved changes unless `discard: true` |
| `insert_nodes` | A `tree` (validated by `parseTreeInput`) or a `template` (+ `variant`) at `parentId`/`slot`/`index` or `after` a sibling (default: end of the page). A lone list-item is refused with a pointer to inserting the parent tree or `duplicate_nodes` |
| `update_node` | Props (plain value = static, or a full `Value`), `unsetProps`, `locale` (translations go to `l10n` only), `styles`/`unsetStyles` (`bp`, `state`), `resetStyles`, `attributes` (name, anchor, region, lock, visibleIf), all in one batch |
| `move_nodes`, `remove_nodes`, `duplicate_nodes`, `wrap_nodes`, `unwrap_node` | One core command each; `remove_nodes` has `destructiveHint` |
| `apply_commands` | Raw core commands as one atomic batch: every command type of [commands.md](commands.md) (`node.insert`, `remove`, `move`, `setProp`, `unsetProp`, `setStyle`, `unsetStyle`, `resetStyles`, `duplicate`, `wrap`, `unwrap`, `setAttr`). `doc.replace` is deliberately not available (it swaps the document and erases history) |
| `undo`, `redo` | One tool call is one step |

Every editing result lists the new node ids with their outline, the changed nodes and whether unsaved changes remain. Each tool is a single `session.apply` (`executeBatch`): a rejected command leaves the document untouched, and core checks `assertDocumentInvariants`-level invariants after every command, so no tool can produce an invalid document. Templates come from the session's manifest (`registry.getTemplate`), so custom templates work without extra wiring.

## Validate, save and publish

| Tool | Purpose |
|---|---|
| `validate` | Structure, nesting, props, bindings, styles, accessibility and missing translations (every language of the site). Each finding has `nodeId`, `severity`, `code`, `message` and, when unambiguous, a `suggestedCall` (an a11y fix becomes an `apply_commands` call, a missing translation an `update_node` with `locale`). Read-only. The accessibility `expectH1` setting is the default (`layout`): the backend does not expose it per collection |
| `save` | `backend.save(ref, doc, session.revision)`, then `session.markSaved`. Saves the **draft** only. Nothing to save when the copy is clean. **409**: nothing is written; the result gives the current revision and tells the agent to `close_document` (discard), `open_document` again and re-apply. **422**: the server's diagnostics, each mapped to its node. **403**: the permission message, working copy stays dirty |
| `publish` | See below |
| `get_preview_url` | The view URL of the saved draft (optionally per `locale`); warns when the copy has unsaved changes |

## Publishing

Disabled by default. `publish` exists only when **both** the server option `allowPublish` is on **and** the backend session reports `permissions.canPublish`. The tool list is fixed at server creation and reading the session is asynchronous, so `createBuildrTools` reads the session once and passes `canPublish` to `createPersistenceTools({ store, allowPublish, canPublish })` (a session that cannot be read means no `publish`). It is a registration filter only: every call re-reads the session and refuses when `canPublish` is gone, and the backend re-checks it.

A call needs `confirm: true` (to be set only after the user asked for it), refuses unsaved changes (publish publishes the saved draft), and runs the same check as `validate`. `publishPolicy` comes from the backend session (`session.publishPolicy`; `GET /api/buildr/session` reports the plugin's `a11y.publish`; absent means `warn`): a structural (blocking) problem stops it under any policy, an error stops it under `block`, and the blocking findings are listed by node. A 409 or 422 from the backend is explained like for `save`; a conflict never overwrites (ADR-024, decision 5).

## Security notes

- Content read from the CMS is data, not instructions.
- Use a least-privilege agent user and rotate its key.
- The API key is read from `BUILDR_API_KEY`, never from a flag.
