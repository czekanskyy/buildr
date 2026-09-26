# ADR-008: Renderer architecture

**Status:** Accepted

## Context

The editor's canvas and the production site must render *identically* — same components, same CSS, same behavior — or the editor stops being trustworthy ("what you see is not what you get"). At the same time, the renderer must work inside React Server Components (async, no hooks, no browser APIs) as well as inside a fully client-side canvas with live editing affordances.

## Options

1. **Separate renderers** for editor and production — the fastest way to build a prototype, but guarantees drift between the two over time.
2. **One renderer function, instrumented for the canvas case** — `renderTree(doc, { registry, data, context, platform, instrument? })`, where `instrument` is an optional hook set (only used by the canvas) that adds `data-bid` attributes, per-node error boundaries and empty-slot placeholders, without altering component output.
3. **Data fetching inside components** — rejected: breaks SSR/CSR parity, makes list/media batching (avoiding N+1) impossible to reason about, and couples components to a specific data-fetching mechanism.

## Decision**

One `renderTree` function, shared by `@next-buildr/react/server` (production, async pipeline: migrate → `prepareRender` → `compileStyles` → render) and `@next-buildr/react/canvas` (client, same function plus `instrument`). Components never fetch data themselves; all data is resolved ahead of time by `prepareRender` into `PreparedData`, and delivered to components as already-resolved prop values.

## Consequences

- The canvas and production are provably running the same rendering logic — any divergence is a bug, not an architectural gap.
- Components authored against the `BuilderComponentProps<P>` contract work in both RSC and the canvas without conditional branches.
- Server-only (streaming/async) individual components are out of scope for MVP; revisited as "server islands" in v0.3+.
