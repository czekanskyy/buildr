# ADR-019: Deployment topology

**Status:** Accepted

## Context

The editor needs to be reachable from Payload's admin, authenticated, and CSP-safe, while the long-term goal (per the product brief) is a standalone builder usable across many client sites/installations.

## Options

1. **A view embedded in Payload Admin** — rejected per the core product requirement (see `README.md`'s "key assumption").
2. **A same-origin route inside the same Next.js application that hosts Payload** — simplest auth story (the existing Payload session cookie just works), simplest CSP (`frame-ancestors 'self'`), no CORS.
3. **A fully standalone, cross-origin editor application** (`apps/page-builder`), usable against multiple, independently-hosted Payload sites — the eventual target, but adds a token handoff flow, CORS configuration, and cross-origin `postMessage` origin management that aren't needed to validate the core architecture.

## Decision**

**MVP ships option 2**: the editor is a separate route/bundle within the same Next.js app as Payload, same-origin. The architecture is deliberately built so option 3 is additive, not a rewrite: the manifest already comes from the adapter (not a hardcoded import), the `postMessage` protocol already validates origin explicitly rather than assuming same-origin, and the adapter already talks to Payload exclusively over HTTP. Standalone cross-origin deployment (with a one-time handoff-code auth flow) is planned for v0.3.

## Consequences

- MVP auth is just "use the existing Payload session cookie" — no new auth flow to build or audit before shipping.
- The v0.3 standalone mode is a scoping/auth-flow change, not an architecture change — validated by the fact that no MVP component assumes same-origin except the auth cookie itself.
