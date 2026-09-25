# ADR-024: MCP server for AI agents

**Status:** Accepted (maintainer decisions, 2026-09-25)

## Context

Agents (Claude Code, Claude Desktop, any client that speaks the [Model Context Protocol](https://modelcontextprotocol.io)) can build pages faster than a human, but only if they use the same safe path a human does. The alternatives are worse: asking a model to emit raw document JSON, HTML or CSS bypasses the command system (ADR-013), the registry rules (ADR-003) and the styling model (ADR-006), and produces content nobody can reliably validate. **Tools, not generation:** the server exposes discovery, editing, validation and persistence tools; the client brings the model. The server never calls an LLM itself.

The architecture already has most of what is needed: a serializable component manifest, headless `execute`/`executeBatch`/`canExecute`, `canInsert`/`canMove`/`canRemove`, `fromTree` and `instantiateTemplate`, `validateDocument`/`runA11y`, and the builder HTTP contract with `baseRevision` (409) and server-side `processLayout` validation (422). What is missing is a home for the agent-facing tool layer, non-cookie authentication, document listing and creation, and the editor noticing that someone else saved. This ADR records nine decisions; each option carries a real trade-off.

## Options and decisions

### 1. Placement

1. **Everything in `@buildr/payload`.** One package, but it ties the tool layer to Payload, pulls the MCP SDK into every site, and makes a non-Payload host impossible.
2. **Only the example app.** No new package, but nothing reusable and no public API.
3. **`@buildr/mcp` (CMS-agnostic tools, sessions, serialization, CLI) plus `@buildr/payload/mcp` (HTTP backend, local backend, route handler).** One more package to version and publish (ADR-021).

**Decision: option 3.** `@buildr/mcp` depends only on `@buildr/core`, `@modelcontextprotocol/sdk` and `zod`; the `McpBackend` interface plays the role `DocumentAdapter` plays for the editor.

### 2. Transport

1. **stdio only.** Zero infrastructure, but every user needs a local process and a key on their machine.
2. **Streamable HTTP only.** One remote endpoint for a team, but local trials need a running site.
3. **Both, over one tool layer.** Two entry points to test; mitigated by one shared test matrix.

**Decision: option 3.** A `buildr-mcp` stdio CLI (`@buildr/mcp/cli`) and a Streamable HTTP route inside the site (`@buildr/payload/mcp`), using the stateless request/response mode so serverless hosting works; session state lives in the edit-session store, not in the connection.

### 3. Authentication

1. **Payload API keys** (`auth.useAPIKey` on the users collection), sent as `Authorization: <collection> API-Key <key>`, for a dedicated low-privilege agent user. Keys are long-lived secrets; mitigated by documenting a least-privilege role and rotation.
2. **OAuth 2.1 per the MCP authorization spec.** The right end state for remote clients, but a large piece of work (authorization server, consent UI, token storage) for a first version.
3. **The handoff-code flow from ADR-019.** Designed for the browser editor, not for non-interactive clients.

**Decision: option 1.** OAuth 2.1 and the ADR-019 handoff flow are the likely next step (with the standalone editor) and are explicitly **not** part of this ADR. The HTTP route rejects cookie-only requests so a browser can never drive it cross-site; the API key is never a CLI flag (it comes from the `BUILDR_API_KEY` environment variable) and never appears in errors or logs.

### 4. Editing model

1. **One server write per tool call.** Simple and always persisted, but noisy version history, no atomic multi-step edits, and a partial page after an interrupted session.
2. **Working copy with autosave.** Feels like the editor, but stores half-finished work as drafts and hides when the agent is done.
3. **In-memory working copy plus an explicit `save` with `baseRevision`.** Tools apply commands locally, cheaply and atomically (each tool is one `executeBatch`); `save` sends the result. Unsaved work is lost when a session expires; mitigated by a 30-minute idle TTL and an explicit `dirty` flag.

**Decision: option 3.** A conflicting save returns the current revision and never overwrites. The server re-validates everything (`processLayout`), so the MCP layer is a convenience, not a trust boundary.

### 5. Publish policy

1. **Drafts only, forever.** Safest, but a human always has to finish the job.
2. **Same as the editor.** Convenient, but an agent (or injected content it read) could take a page live.
3. **Opt-in with confirmation.** Disabled by default; needs the plugin option `mcp.allowPublish`, the user's `canPublish`, and an explicit `confirm: true` argument; a site with `publishPolicy: block` refuses while errors are outstanding. More configuration.

**Decision: option 3.** `publish` is not even registered unless both the server option and the backend session's `canPublish` allow it.

### 6. Collaboration with an open editor

1. **Only the existing 409 at save time.** No work, but the human learns about the agent's save late.
2. **Revision detection plus a banner** in the editor (PB-143): a revision check on focus and every 30 s while idle, a non-blocking "reload the latest version" banner naming who saved, and the conflict dialog shown early when there are local edits. Costs some polling, kept low by not polling while the tab is hidden.
3. **Live sync.** Belongs to post-1.0 collaboration (Yjs).

**Decision: option 2.** Live sync is out of scope until post-1.0 collaboration.

### 7. Document operations

1. **Editing only.** Smallest surface, but an agent cannot start from an empty site.
2. **Create drafts and edit.** Slightly larger surface; creation respects collection access and never auto-publishes.
3. **Full CRUD including deletion.** Deletion by an agent is effectively irreversible.

**Decision: option 2** (`list_documents`, `create_document`, editing). There is no deletion tool.

### 8. Visual feedback

1. **Screenshots in the first version.** Multimodal agents can check their work, but it needs a browser on the server (heavy, operationally risky).
2. **None, ever.** Lightest, but the agent is blind to layout.
3. **Later and optional.** The first version offers `get_preview_url`; `render_preview` (PB-146) stays opt-in behind a flag, Playwright is an optional peer dependency, and work starts only after a review once the rest of the phase has landed.

**Decision: option 3.**

### 9. Roadmap and scope

This ships in **v0.2**, in parallel with phase 13; the ADR goes first because it unblocks the phase. The server exposes tools, resources and prompts only. AI generation inside the product (the server calling a model) stays post-1.0.

## Consequences

- New package `@buildr/mcp` (with a `./cli` subpath) and a new subpath `@buildr/payload/mcp`, with boundary rules enforced by dependency-cruiser (see `docs/ai/package-boundaries.md`). `@buildr/mcp` must not import `react`, `next`, `payload` or any `@buildr/*` package other than `@buildr/core`; the CLI reaches the HTTP backend through an optional peer dependency.
- The document model, the command system and the server-side validation are unchanged; an agent cannot do anything the same user cannot do in the editor.
- Payload gains the plugin option `mcp: { enabled, allowPublish, collections? }` (off by default), document list and create endpoints, and API-key requests attributed to the agent user (PB-139).
- The editor gains an optional `DocumentAdapter.getRevision` and an external-change banner (PB-143).
- Security guidance for the docs: content read from the CMS is data, not instructions; use least-privilege keys; publishing is disabled by default.
- Reversing any of these decisions (for example, adding OAuth 2.1) needs a new ADR that supersedes this one.
