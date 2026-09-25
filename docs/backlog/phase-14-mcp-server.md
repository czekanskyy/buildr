# Phase 14: MCP server — building pages with AI agents

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI agent (Claude Code, Claude Desktop, any MCP client) discover the component catalogue, read a page, change it **through the same commands the editor uses**, validate it and save it as a draft — so that a human can open the result in the visual editor and continue.

This moves part of "AI-assisted generation" (listed as post-1.0 in [../roadmap.md](../roadmap.md)) forward. It does so without touching the architecture's invariants: the agent never writes raw JSON into the database, never produces HTML/CSS, and every change goes through `@buildr/core/commands`, the registry rules and the server-side `processLayout` validation.

## Why this fits the existing architecture

| Need | Already there |
|---|---|
| A machine-readable catalogue | `ComponentMeta` is fully serializable (ADR-003); the manifest is served at `GET /api/buildr/manifest` and `createRegistryMeta` rebuilds a `RegistryMeta` from it |
| Safe mutations | `execute` / `executeBatch` / `canExecute`, `canInsert` / `canMove` / `canRemove` in `@buildr/core` (headless, no React) |
| Building whole sections in one step | `fromTree` (nested `{ type, props, slots }`), `instantiateTemplate` |
| Quality gates | `validateDocument`, `runA11y`, missing-translation diagnostics |
| Persistence with conflict detection | `GET/POST /api/buildr/document`, `save` with `baseRevision` (409), `publish`, `422` diagnostics (`packages/payload/src/contract.ts`) |
| Data for bindings | `GET /api/buildr/data-schema/:collection`, `media` listing |

What is missing: a place for the agent-facing tool layer, authentication that is not a browser cookie, listing and creating documents, an agent-friendly representation of a document, and the editor noticing that someone else (an agent) saved.

## Decisions (Q&A with the maintainer, 2026-09-25)

These are the decisions ADR-024 (PB-132) records. The ADR still documents the rejected options and their trade-offs.

| # | Question | Decision | Rejected |
|---|---|---|---|
| M1 | Transport | **Both**: a stdio CLI (`buildr-mcp`) and a Streamable HTTP endpoint inside the site, sharing one tool layer | stdio only; HTTP only |
| M2 | Authentication | **Payload API keys** (`auth.useAPIKey` on the users collection) for a dedicated, low-privilege agent user | OAuth 2.1 now (too large for the first version; may come later with the standalone editor) |
| M3 | Publishing | **Opt-in plus confirmation**: disabled by default; needs the plugin option `mcp.allowPublish`, the user's `canPublish` and `confirm: true`; `publishPolicy: block` is respected | drafts only, forever; same as the editor |
| M4 | Placement | **`@buildr/mcp`** (CMS-agnostic tools, sessions, serialization, CLI) plus **`@buildr/payload/mcp`** (HTTP backend, local backend, route handler) | everything in `@buildr/payload`; the example app only |
| M5 | Editing model | **In-memory working copy plus an explicit `save`** with `baseRevision` | one server write per tool call; working copy with autosave |
| M6 | An editor open at the same time | **Revision detection plus a banner** in the editor (PB-143) | only the existing 409 at save time; live sync (that belongs to post-1.0 collaboration) |
| M7 | Visual feedback | **Later and optional**: PB-146 stays opt-in, after the rest of the phase; the first version offers `get_preview_url` | screenshots in the first version; dropping the idea |
| M8 | Scope of document operations | **Creating drafts** (`create_document`) plus editing | editing only; full CRUD including deletion |
| M9 | Schedule | Runs **in parallel with phase 13** and ships in **v0.2**; PB-132 goes first because it unblocks the phase | — |

## Target architecture

```
 MCP client (Claude Code / Desktop / other)
        |  stdio                         |  Streamable HTTP (+ Bearer API key)
        v                                v
 buildr-mcp CLI (@buildr/mcp/cli)    route handler in the site (@buildr/payload/mcp)
        \                                /
         +---- @buildr/mcp (tools, sessions, serialization) ----+
                         |  McpBackend interface
          +--------------+------------------+
          v                                 v
  HTTP backend over contract.ts     memory / file backend
  (@buildr/payload/mcp)             (tests, playground)
          |
   /api/buildr/*  (Payload plugin: processLayout, write-guard, access control)
```

- `@buildr/mcp` depends only on `@buildr/core`, `@modelcontextprotocol/sdk` and `zod`; it is CMS-agnostic, exactly like the editor is (the `McpBackend` interface plays the role of `DocumentAdapter`).
- The agent works on an **in-memory working copy** (an edit session): tools apply commands locally, cheaply and atomically, and `save` sends the result with `baseRevision`. The server re-validates everything (`processLayout`), so the MCP layer is a convenience, not a trust boundary.
- Publishing is off by default and, when enabled, requires both the user's `canPublish` permission and an explicit `confirm: true` argument.

## Tool surface (target)

| Group | Tools | Notes |
|---|---|---|
| Discovery (read-only) | `list_components`, `describe_component`, `list_templates`, `describe_template`, `get_style_reference`, `get_data_schema`, `list_media` | Derived from the manifest and theme; cached per manifest hash |
| Documents | `list_documents`, `create_document`, `open_document`, `get_outline`, `get_node`, `close_document` | `open_document` returns a `sessionId`, the revision and the outline |
| Editing | `insert_nodes` (tree or template), `update_node` (props, styles, attributes, translations), `move_nodes`, `remove_nodes`, `duplicate_nodes`, `wrap_nodes`, `unwrap_node`, `apply_commands` (raw, atomic batch), `undo`, `redo` | Every tool is one `executeBatch` — all or nothing, with rule-violation messages written for an agent to act on |
| Quality | `validate` | Validation + accessibility + missing translations, each with `nodeId` and a suggested fix |
| Persistence | `save`, `publish`, `get_preview_url` | `save` reports 409 with a rebase hint and 422 with diagnostics |
| Resources | `buildr://guide`, `buildr://components/{type}`, `buildr://templates/{id}`, `buildr://style-reference` | The guide teaches the model how Buildr pages are structured |
| Prompts | `build-page`, `add-section`, `translate-page`, `fix-issues` | Parameterised starting points for clients that surface prompts |

## Order

```
PB-132 (ADR) -> PB-133 -> PB-134 -> PB-135 -> { PB-136, PB-137 } -> PB-138
PB-132 -> PB-139 (Payload API keys + endpoints) -> PB-140 (HTTP backend)
PB-138 + PB-140 -> PB-141 (stdio CLI)
PB-138 + PB-139 -> PB-142 (HTTP route in the site)
PB-141 + PB-142 -> PB-144 (guide) -> PB-145 (E2E)
PB-139 -> PB-143 (editor: external changes) -> PB-145
PB-142 -> PB-146 (preview screenshots, optional)
```

---

## PB-132 - ADR-024: MCP server for AI agents - S

- **Purpose**: write down the decisions this phase depends on before any code is written (AGENTS.md: no speculative architecture). They were agreed with the maintainer on 2026-09-25 (M1–M9 above).
- **Dependencies**: PB-114
- **Files**: `docs/adr/ADR-024-mcp-server.md`, `docs/adr/README.md`, `docs/ai/architecture-decisions.md`, `docs/ai/package-boundaries.md` (new rows), `docs/mcp.md` (skeleton)
- **Implementation**: an ADR in the standard template. Context: why agents, and why tools rather than generation. For every decision M1–M8, the options that were considered, a real trade-off for each, and the chosen one:
  1. **Placement** (M4): `@buildr/mcp` plus `@buildr/payload/mcp`.
  2. **Transport** (M1): stdio and Streamable HTTP, one tool layer.
  3. **Authentication** (M2): Payload API keys sent as `Authorization: <collection> API-Key <key>`; OAuth 2.1 per the MCP authorization spec and the handoff-code flow from ADR-019 are recorded as the likely next step, not as part of this ADR.
  4. **Editing model** (M5): working copy plus `save` with `baseRevision`.
  5. **Publish policy** (M3): opt-in, `canPublish`, `confirm: true`, `publishPolicy` respected.
  6. **Collaboration** (M6): revision detection plus a banner; live sync out of scope until post-1.0 collaboration.
  7. **Document operations** (M8): create drafts and edit; no deletion.
  8. **Visual feedback** (M7): optional, behind a flag, gated on a later review of PB-146.
  9. **Roadmap**: v0.2. The server never calls an LLM itself: it exposes tools, and the client brings the model.
- **Tests**: none (documentation).
- **Acceptance criteria**: the ADR is merged with status `Accepted`; `package-boundaries.md` has the rows for `@buildr/mcp`, `@buildr/mcp/cli` and `@buildr/payload/mcp`, and dependency-cruiser can enforce them.
- **Risks**: none (the decisions are already agreed).

## PB-133 - `@buildr/mcp` package scaffold and backend interface - M

- **Purpose**: the package, its boundaries and the seam every host and backend plugs into.
- **Dependencies**: PB-132
- **Files**: `packages/mcp/**` (`package.json`, `tsconfig.json`, `src/{index,backend,server}.ts`, `src/backends/memory.ts`), `.dependency-cruiser.cjs`, `turbo.json`, `.changeset/*`
- **Implementation**:
  - `McpBackend` (validated at the boundary with Zod): `getSession()`, `getManifest()`, `getTheme()`, `listDocuments(query)`, `createDocument(input)`, `load(ref, { locale })`, `save(ref, doc, baseRevision)`, `publish(ref, baseRevision)`, `getDataSchema(collection)`, `listMedia(query)`, `previewUrl(ref, locale)`. Error results are typed (`conflict`, `invalid`, `forbidden`, `not-found`, `network`).
  - `createBuildrMcpServer({ backend, options })` returning an MCP `Server` from `@modelcontextprotocol/sdk` with no tools yet (they arrive in PB-136 – PB-138), server info, capabilities and the instructions string.
  - `createMemoryBackend({ manifest, theme, documents })` for tests and the playground.
  - dependency-cruiser rules: `@buildr/mcp` may import `@buildr/core`, `@modelcontextprotocol/sdk`, `zod`; must not import `react`, `next`, `payload`, any other `@buildr/*` package.
- **Tests**: backend contract tests (a reusable suite run against the memory backend now and the HTTP backend in PB-140); a smoke test connecting an in-memory MCP client to the server.
- **Acceptance criteria**: `pnpm check:boundaries` enforces the new rules; the package builds and publishes like the others (ADR-021).
- **Risks**: the MCP SDK's API moves quickly — mitigated by a pinned range and isolating SDK calls in `server.ts`.

## PB-134 - Edit sessions: the agent's working copy - M

- **Purpose**: a headless, command-driven document session — the editor store without React.
- **Dependencies**: PB-133
- **Files**: `packages/mcp/src/session/**`
- **Implementation**: `EditSession { id, ref, revision, locale, doc, registry, history }` built from `load()` + `createRegistryMeta(manifest)`; `apply(commands)` via `executeBatch` (atomic), `undo`/`redo` via `createHistory`; `dirty` derived from the history cursor; a session store with a TTL (default 30 min idle), a per-backend-user cap (default 5 sessions) and the node/byte limits from `getSession().limits`; the manifest hash is pinned per session — a manifest change forces a reopen with a clear error.
- **Tests**: unit (batch atomicity: a failing command leaves the document untouched; undo/redo; TTL with an injected clock; limit errors); a property test reusing core's `undo . do = id` generator.
- **Acceptance criteria**: no code path mutates a document outside `execute` (the frozen-document test from PB-074, reused).
- **Risks**: none.

## PB-135 - Agent-facing serialization - M

- **Purpose**: representations a language model reads and writes reliably, and errors it can act on.
- **Dependencies**: PB-134
- **Files**: `packages/mcp/src/serialize/**`
- **Implementation**:
  - **Outline**: an indented, token-efficient text view of a (sub)tree — id, type, name, the inline/primary prop, slot names, lock/visibility markers — with `depth` and `nodeId` limits; a JSON variant for clients that prefer it.
  - **Node detail**: all props as `Value`s (static, binding, expression, translations), styles per layer, attributes.
  - **Component description**: props as a compact schema (kind, default, options, `bindable`, `localizable`, constraints), slots with allowed children and min/max, parent rules, style groups, a11y requirements, and a minimal valid example tree generated from the defaults.
  - **Tree input schema**: a Zod schema for `fromTree` input with `.describe()` texts, exported as JSON Schema for tool definitions; unknown types and props rejected with the list of valid ones.
  - **Error rendering**: command and rule rejections (`canInsert` reasons, prop validation, locks) turned into one-sentence explanations plus the nearest valid alternative (for example "`buildr/list-item` can only be placed inside `buildr/list`; allowed children of `buildr/section` are: ...").
- **Tests**: snapshot tests of outline and descriptions for every built-in component (reviewed); round-trip (description example -> `fromTree` -> `canInsert` succeeds); every rejection code has an explanation (a test enumerates the codes).
- **Acceptance criteria**: the outline of the 1000-node fixture stays under 40k characters at depth 3.
- **Risks**: token cost on large pages — mitigated by depth limits and subtree addressing.

## PB-136 - Discovery tools and resources - M

- **Purpose**: let the agent learn what it can build before it builds.
- **Dependencies**: PB-135
- **Files**: `packages/mcp/src/tools/discovery.ts`, `packages/mcp/src/resources/**`
- **Implementation**: tools `list_components` (grouped by category, one line each), `describe_component`, `list_templates`, `describe_template` (outline of the instantiated fragment), `get_style_reference` (style groups, properties, the value grammar in examples, theme tokens, breakpoints), `get_data_schema`, `list_media`; resources `buildr://components/{type}`, `buildr://templates/{id}`, `buildr://style-reference`; all annotated `readOnlyHint: true`; responses cached per manifest hash.
- **Tests**: integration through an in-memory MCP client against the memory backend with the default registry's manifest.
- **Acceptance criteria**: every built-in component and template is discoverable and describable; tool input schemas validate.
- **Risks**: none.

## PB-137 - Document and editing tools - L

- **Purpose**: the tools that actually build pages.
- **Dependencies**: PB-135
- **Files**: `packages/mcp/src/tools/{documents,editing}.ts`
- **Implementation**: `list_documents`, `create_document` (collection, title, slug, optional template), `open_document` (returns `sessionId`, revision, `layoutSource`, outline), `get_outline`, `get_node`, `close_document`; editing tools as listed in the tool surface table, each one `executeBatch` on the session: `insert_nodes` accepts a tree (validated by PB-135's schema) or a template id and a position (`parentId` + `slot` + `index`, or `after: nodeId`); `update_node` merges props (with `locale` for translations), styles (`layer` = base / breakpoint) and attributes into one batch; `apply_commands` accepts raw core commands for anything else. Every result returns the changed nodes' outline and the new ids. Annotations: `destructiveHint` on remove, `idempotentHint` where true.
- **Tests**: integration (build the Hero + FeatureGrid + CTA landing page from scenario 1 purely through tools; a forbidden insert returns the explanation and leaves the document unchanged; a translation writes to `l10n` only).
- **Acceptance criteria**: every command type in `docs/commands.md` is reachable; no tool can produce a document that fails `assertDocumentInvariants`.
- **Risks**: tool sprawl confusing the model — mitigated by few, composable tools with rich descriptions and `apply_commands` as the escape hatch.

## PB-138 - Validation, save and publish tools - M

- **Purpose**: close the loop: check, persist, and (optionally) go live.
- **Dependencies**: PB-136, PB-137
- **Files**: `packages/mcp/src/tools/{quality,persistence}.ts`
- **Implementation**: `validate` (validation + a11y + missing translations for the session's locales, each item with `nodeId`, severity, message and a suggested tool call to fix it); `save` (sends `baseRevision`; on 409 returns the current revision and instructs to reopen and re-apply, never overwrites; on 422 returns the server's diagnostics mapped to nodes); `publish` (only registered when the backend session reports `canPublish` and the server option `allowPublish` is on; requires `confirm: true`; refuses with outstanding errors when the site's `publishPolicy` is `block`); `get_preview_url`.
- **Tests**: integration against the memory backend with injected 409/422/403 responses.
- **Acceptance criteria**: a document with validation errors cannot be published through MCP when the policy is `block`; a conflicting save never loses the other writer's changes.
- **Risks**: none.

## PB-139 - Payload: API-key access and document endpoints - M

- **Purpose**: the server-side pieces an agent needs that a browser session never did.
- **Dependencies**: PB-132
- **Files**: `packages/payload/src/plugin/{options,access}.ts`, `plugin/endpoints/{documents,index}.ts`, `packages/payload/src/contract.ts`, `docs/payload.md`
- **Implementation**:
  - Plugin option `mcp: { enabled, allowPublish, collections? }` (off by default).
  - Documentation and a check that the users collection has `auth.useAPIKey` when `mcp.enabled`; requests authenticated by API key are marked (`req.user` + a flag) so writes record the agent's user in `updatedBy` and in version history.
  - `GET /buildr/documents?collection&search&page` — builder-enabled documents the user may read (title, slug, status, `updatedAt`, `layoutSource`).
  - `POST /buildr/documents` — creates a draft in a builder-enabled collection (title, slug, optional template id), respecting collection access.
  - Contract schemas for both, shared with the HTTP backend.
  - Rate limiting on write endpoints for API-key requests (reusing the forms rate limiter's approach).
- **Tests**: Payload integration (SQLite): API-key auth reaches the endpoints; access control per collection; a user without create access gets 403; drafts only, never auto-published.
- **Acceptance criteria**: an API-key user can do exactly what the same user can do in the editor, nothing more.
- **Risks**: API keys are long-lived secrets — mitigated by documenting a dedicated low-privilege "agent" user role and key rotation.

## PB-140 - HTTP backend over the builder API - M

- **Purpose**: connect `@buildr/mcp` to a real site.
- **Dependencies**: PB-133, PB-139
- **Files**: `packages/payload/src/mcp/**` (new `./mcp` subpath), `packages/payload/package.json`
- **Implementation**: `createPayloadMcpBackend({ baseUrl, apiKey, collection = 'users' })` implementing `McpBackend` over `contract.ts` (every response parsed with the contract schemas; documents with `parseDocument`); timeouts, retry with backoff for idempotent requests only; the API key never appears in errors or logs. Boundary: `@buildr/payload/mcp` may import `@buildr/core`, `@buildr/mcp` (types and backend tests) and `./contract`; it must not import `payload` or `next`.
- **Tests**: the PB-133 backend contract suite against a mock `fetch`; one integration run against the example app's Payload (SQLite).
- **Acceptance criteria**: the contract suite passes for both backends.
- **Risks**: none.

## PB-141 - stdio CLI `buildr-mcp` - S

- **Purpose**: the zero-infrastructure way to use the server from Claude Code or Claude Desktop.
- **Dependencies**: PB-138, PB-140
- **Files**: `packages/mcp/src/cli/**`, `packages/mcp/package.json` (`bin`), `docs/mcp.md`
- **Implementation**: `buildr-mcp --url <site> ` with the API key from `BUILDR_API_KEY` (never a flag, to keep it out of shell history and process lists); `--playground <dir>` runs against JSON files with the default registry's manifest (a file backend on top of the memory backend) for trying things without a CMS; logs to stderr only; clean shutdown. The CLI resolves the HTTP backend from `@buildr/payload/mcp` through an optional peer dependency, so `@buildr/mcp` itself stays CMS-agnostic.
- **Tests**: a spawn test speaking JSON-RPC over stdio (initialize, list tools, call `list_components`) in playground mode.
- **Acceptance criteria**: `claude mcp add buildr -- npx buildr-mcp --url http://localhost:3000` works against the example app (documented in `docs/mcp.md`).
- **Risks**: none.

## PB-142 - Streamable HTTP endpoint in the site - M

- **Purpose**: a remote MCP server every team member's client can connect to, without a local process.
- **Dependencies**: PB-138, PB-139
- **Files**: `packages/payload/src/mcp/route.ts`, `apps/example-next-payload/src/app/(builder)/api/buildr/mcp/route.ts`, `docs/{mcp,nextjs}.md`
- **Implementation**: `createBuildrMcpRoute({ payload, registry })` — a Next.js route handler using the SDK's Streamable HTTP transport; authenticates the `Authorization` header through Payload's API-key strategy (and rejects cookies, so a browser can never drive it cross-site); uses a **local** backend (Payload's local API with the request's user and the site's own registry — no HTTP hop); per-user session store as in PB-134; `Origin` validation as required by the MCP transport spec; rate limiting; disabled unless `mcp.enabled`.
- **Tests**: integration in the example app (SQLite): an SDK client connects with a key, builds a section, saves; missing/invalid key -> 401; a request carrying only the session cookie -> 401.
- **Acceptance criteria**: the same tool suite passes over stdio and over HTTP (one shared test matrix).
- **Risks**: serverless platforms and long-lived connections — mitigated by using the stateless request/response mode of Streamable HTTP and keeping sessions in the edit-session store, not in the connection.

## PB-143 - Editor: detecting external changes - M

- **Purpose**: an agent and a human can work on the same page without the human hitting a surprise 409.
- **Dependencies**: PB-139, PB-087
- **Files**: `packages/editor/src/persistence/**`, `packages/payload/src/adapter/document-adapter.ts`, `packages/payload/src/plugin/endpoints/document.ts` (a lightweight `HEAD`/revision query), the editor message catalogs
- **Implementation**: the editor checks the document's revision on window focus and every 30s while idle (`adapter.getRevision?`, optional in `DocumentAdapter`); when it changed and there are no local edits it offers "Reload the latest version" (a non-blocking banner naming who saved, e.g. the agent user); with local edits it shows the existing conflict dialog early instead of at the next save.
- **Tests**: integration against a fake adapter with fake timers (clean reload, dirty conflict, no polling while hidden).
- **Acceptance criteria**: no data loss in the tested scenarios; no polling while the tab is hidden.
- **Risks**: none (live co-editing stays out of scope).

## PB-144 - The agent guide, prompts and documentation - M

- **Purpose**: models build good pages when they are told how Buildr thinks.
- **Dependencies**: PB-141, PB-142
- **Files**: `packages/mcp/src/{resources/guide.md,prompts/**}`, `docs/mcp.md`, `docs/ai-agents.md`, `README.md`
- **Implementation**: `buildr://guide` — the page structure (Page > Section > Container > content), when to use templates vs. trees, styles via tokens and breakpoints (mobile overrides), bindings and formulas in two examples, localization rules (structure shared, text per locale), accessibility requirements (one `h1`, alt texts, labelled forms), the validate-then-save workflow, and what never to do (publish without being asked, invent component types). Prompts `build-page`, `add-section`, `translate-page`, `fix-issues`. `docs/mcp.md`: installing, creating an agent user and key, connecting Claude Code / Claude Desktop / a generic client over stdio and HTTP, the tool reference (generated from the tool definitions), security notes (content read from the CMS is data, not instructions; least-privilege keys; publish disabled by default).
- **Tests**: a test that the tool reference in `docs/mcp.md` is up to date with the registered tools.
- **Acceptance criteria**: someone new connects an agent and builds a page from the docs alone in under 15 minutes (recorded in the PR).
- **Risks**: none.

## PB-145 - End-to-end scenarios over MCP - L

- **Purpose**: proof that an agent can build every MVP scenario.
- **Dependencies**: PB-144, PB-143
- **Files**: `apps/example-next-payload/e2e/mcp/**`, `packages/mcp/evals/**`, the `e2e` CI job
- **Implementation**:
  - **Deterministic suite (CI)**: a scripted MCP client (no LLM) builds scenarios 1, 2, 4 and 6 and translates one page (scenario 7) against the example app over HTTP; asserts zero validation and a11y errors, then opens the result in the editor (Playwright) and on the public draft preview.
  - **Agent evals (manual / nightly, not blocking)**: briefs such as "a landing page for a bakery with a hero, three features, pricing and a contact form"; a harness runs a real model through the stdio server and scores the result by rules (validates, a11y clean, uses templates where they fit, no empty slots, both locales) — results tracked over time, not asserted.
  - The editor opened on an agent-built page shows no issues and every node is editable.
- **Tests**: (this task *is* the test suite)
- **Acceptance criteria**: the deterministic suite is stable (zero flakes across 20 runs); an eval report exists in the PR.
- **Risks**: cost and nondeterminism of real-model evals — kept out of the blocking CI path.

## PB-146 - Visual feedback: preview screenshots (optional) - M

- **Purpose**: let multimodal agents look at what they built.
- **Dependencies**: PB-142
- **Files**: `packages/mcp/src/tools/preview.ts`, `packages/payload/src/mcp/**`
- **Implementation**: a `render_preview` tool (registered only when enabled) that saves nothing: it renders the session's working copy through the site's draft preview route at a chosen breakpoint and returns an image content block; Playwright as an **optional** peer dependency; a hard timeout and one concurrent render per user.
- **Tests**: integration in the example app (image returned, correct viewport width, no persistence side effects).
- **Acceptance criteria**: disabled by default; the MCP package has no hard dependency on a browser.
- **Risks**: heavy dependency and resource use on the server — hence optional and opt-in (M7); start only once PB-145 has landed and the maintainer confirms it is still wanted.
