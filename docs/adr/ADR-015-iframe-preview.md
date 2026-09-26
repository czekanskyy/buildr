# ADR-015: Iframe preview

**Status:** Accepted

## Context

The canvas must render with full fidelity to production (same renderer, same global CSS, same fonts, real responsive breakpoints) while remaining safely isolated from the editor's own UI and JavaScript.

## Options

1. **Render the document tree directly inside the editor's own React tree** — simplest wiring, but requires loading the target site's global CSS into the editor (style collisions in both directions), and media queries would respond to the *editor's* window size, not a simulated device viewport, forcing a rewrite to container queries.
2. **An iframe pointing at a real Next.js route** (same-origin in MVP, cross-origin option in v0.3), synchronized with the editor over `postMessage`.

## Decision**

The canvas is an **iframe loading a real Next.js route** that renders through the exact same `renderTree`/`renderDocument` pipeline as production, instrumented via `@next-buildr/react/canvas`. The editor owns document state exclusively; the canvas holds a read-only, patch-synchronized replica. Resizing the iframe to a breakpoint's width makes real CSS media queries fire — no simulation needed. Communication uses a versioned, schema-validated `postMessage` protocol (see `docs/editor.md` and ADR-016).

## Consequences

- Perfect visual/behavioral fidelity between editing and production, at the one-time cost of building and testing a `postMessage` protocol, overlay rendering, and drag-and-drop hit-testing across the iframe boundary.
- Full CSS/JS isolation: a broken custom component in the canvas cannot crash the editor shell.
- This is the largest single source of editor UX risk (risk R1 in the backlog) and receives a dedicated time budget for tuning drag-and-drop and hit-testing.
