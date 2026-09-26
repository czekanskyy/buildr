# Implementation backlog

## Conventions

- A task ID (`PB-xxx`) is a stable identifier, not a queue position. Order follows dependencies, not numbering — for example PB-115-117 were added later (once localization was scoped into the MVP) and belong to phases 9-11, not to a "phase 13".
- One task = one PR = one agent. Do not combine tasks; do not let a task grow beyond its stated size.
- Sizes: **S** <= 0.5 day, **M** ~= 1 day, **L** ~= 2 days. Anything larger must be split before work starts.
- An agent touches only the files/directories a task's card lists, plus tests and documentation for the area changed.
- Every task must additionally satisfy the general [Definition of Done](../ai/component-development.md#definition-of-done-component) (or the matching category's DoD — component, composite, editor feature, Payload integration, Next.js integration — summarized in [AGENTS.md](../../AGENTS.md#definition-of-done-summary)).

## Phases

All phases are implemented as of 1.0.0, except the task named in the Status column.

| Phase | File | Tasks | Theme | Status |
|---|---|---|---|---|
| 0 | [phase-00-foundation.md](phase-00-foundation.md) | PB-000 – PB-005 | Repository, tooling, CI, release plumbing | Done |
| 1 | [phase-01-core-document.md](phase-01-core-document.md) | PB-006 – PB-011 | Core primitives, the document model | Done |
| 2 | [phase-02-core-registry.md](phase-02-core-registry.md) | PB-012 – PB-018 | Prop schema DSL, component registry, templates | Done |
| 3 | [phase-03-core-values-data-expressions.md](phase-03-core-values-data-expressions.md) | PB-019 – PB-026 | Values, data, expressions | Done |
| 4 | [phase-04-core-styles.md](phase-04-core-styles.md) | PB-027 – PB-030 | The style model and CSS compiler | Done |
| 5 | [phase-05-core-commands.md](phase-05-core-commands.md) | PB-031 – PB-043 | Commands, history, validation, accessibility, drag-and-drop | Done |
| 6 | [phase-06-react-renderer.md](phase-06-react-renderer.md) | PB-044 – PB-049 | The React renderer | Done |
| 7 | [phase-07-components.md](phase-07-components.md) | PB-050 – PB-064 | The component and template catalog | Done |
| 8 | [phase-08-protocol-canvas.md](phase-08-protocol-canvas.md) | PB-065 – PB-072 | The postMessage protocol and canvas runtime | Done |
| 9 | [phase-09-editor.md](phase-09-editor.md) | PB-073 – PB-092, PB-115 | The editor application | Done |
| 10 | [phase-10-payload.md](phase-10-payload.md) | PB-093 – PB-102, PB-116 | The Payload plugin and integration | Done |
| 11 | [phase-11-nextjs.md](phase-11-nextjs.md) | PB-103 – PB-107, PB-117 | The Next.js integration | Done |
| 12 | [phase-12-example-e2e-release.md](phase-12-example-e2e-release.md) | PB-108 – PB-114 | The example app, end-to-end tests, the 0.1.0 release | Done. The performance-budget criterion and a fresh-machine run are not met, see [roadmap](../roadmap.md#exit-criteria-and-where-they-stand-at-100) |
| 13 | [phase-13-editor-visual-polish.md](phase-13-editor-visual-polish.md) | PB-118 – PB-131, PB-147 | Editor visual polish: a new visual identity, tokens, icons, spacing, layout (no behaviour changes) | Done (PB-131 closes it; known follow-ups are in its card) |
| 14 | [phase-14-mcp-server.md](phase-14-mcp-server.md) | PB-132 – PB-146 | An MCP server that lets AI agents build pages through the builder's commands | Done except PB-146 (preview screenshots), which is optional and not implemented |

See [dependency-graph.md](dependency-graph.md) for the full dependency graph, the critical path, and suggested parallel work tracks for multiple agents.

## MVP coverage checklist

Every item in the MVP scope (see [../roadmap.md](../roadmap.md)) must be traceable to at least one task above. This checklist is maintained as tasks land; a task's card is the authoritative acceptance criteria.

## Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Drag-and-drop and overlay complexity across the iframe boundary | UX, latency | A pure, DOM-free `computeDropTarget`; forwarding batched per animation frame; a dedicated tuning time budget (PB-070, PB-086); E2E coverage |
| R2 | Payload Admin overwriting `layout` with a stale value | Data loss | The write-guard hook plus a dedicated concurrent-edit integration test (PB-093, PB-095); fallback: an explicit "read the latest draft" step inside the hook |
| R3 | Payload 3.x / Next.js API changes (caching, draft mode) | Integration breakage | Pinned peer ranges, a nightly compatibility matrix, isolation inside `payload/next` and `next/` |
| R4 | Component authors breaking the RSC/client boundary | Runtime errors | The `*.client.tsx` convention, a convention-checking test, dev-time serializability assertions, documentation |
| R5 | Canvas performance on large documents | UX | Normalization, patches, per-node memoization, nightly benchmarks |
| R6 | Expression language scope creep | Security, maintainability | Grammar changes only via an ADR-005 amendment; CEL is the documented fallback |
| R7 | The style model being too restrictive | User frustration | Style presets (v0.2), a restricted `calc()` escape hatch (v1.0), a fast process for adding new properties |
| R8 | Non-standard Lexical nodes coming from Payload | Missing page content | Extensible converters, diagnostics for unknown nodes |
| R9 | A migration bug corrupting documents | Data loss | Forward-only migrations, a fixture corpus, in-memory migration on read, Payload's own version history as a backstop |
| R10 | Editor UX quality (the primary adoption risk) | Low adoption | The playground for fast iteration, a design review of templates, user testing before v0.2 |
| R11 | Architectural drift introduced by agents | Technical debt | dependency-cruiser in CI, AGENTS.md, small tasks, mandatory human review |
| R12 | A race on the revision check at save time | Rare overwrite | Single-flight saves; a database transaction is planned for v1.0 |
| R13 | Visual polish drifting into behaviour changes | Regressions in a working editor | Phase 13 freezes behaviour; every task is reviewed as a screenshot diff against the PB-118 baseline; existing integration tests must pass unchanged |
| R14 | An AI agent producing broken or unwanted pages | Content quality, trust | Agents only use core commands on a working copy; server-side `processLayout` re-validates; saves are drafts; publish disabled by default and gated by `canPublish` + `confirm` (PB-138, PB-139) |
| R15 | Leaked or over-privileged API keys used by agents | Unauthorized edits | A dedicated low-privilege agent role, keys only via environment variables, rate limits, `updatedBy` audit trail (PB-139, PB-144) |
| R16 | Prompt injection through CMS content read by an agent | An agent taking unintended actions | Content is returned as data, the guide says so explicitly, destructive tools are annotated, publish requires explicit confirmation (PB-138, PB-144) |
