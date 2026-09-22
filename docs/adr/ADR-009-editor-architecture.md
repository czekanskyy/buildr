# ADR-009: Editor architecture

**Status:** Accepted

## Context

Per the product's core requirement, the editor is a **separate product**, not a full-screen field embedded in Payload's admin UI. It needs its own state model, its own UI, and a way to preview real pages with full fidelity.

## Options

1. **A view inside Payload Admin** — rejected per the stated requirement; also would tie the editor's UI stack to Payload's admin component library and its constraints.
2. **A separate client application**, mounted as its own route/bundle, talking to Payload only through a documented HTTP contract.
3. **State management**: Redux, a bespoke store, or Zustand.

## Decision**

`@buildr/editor` is a standalone client package exposing `<BuilderEditor adapter={...} manifest={...} canvasUrl={...} documentRef={...} />`. It uses **Zustand** (vanilla store + selectors) for editor state, but document *mutation* logic never lives in the store — it lives in `@buildr/core/commands`; the store only dispatches commands and reacts to their results (see ADR-013).

## Consequences

- The editor package has zero dependency on Payload or Next.js; it can run against any `DocumentAdapter` implementation (see `packages/test-utils` `MemoryAdapter`, used by the `apps/playground` app).
- Payload/Next integration is entirely about *hosting* the editor (auth, routing, data adapter) — see ADR-010, ADR-011, ADR-019.
- Cross-origin, fully standalone editor deployment (one editor serving many client sites) is architecturally supported but deferred to v0.3 (ADR-019).
