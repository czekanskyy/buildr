# ADR-002: Canonical document AST

**Status:** Accepted

## Context

The document is the single source of truth for a page: it must support O(1) lookups, cheap moves and inserts, deterministic serialization, forward-compatible evolution, and — eventually — real-time collaboration (CRDTs). It must never leak implementation details (HTML, JSX, framework-specific state) into storage.

## Options

1. **Nested JSON** (`{ type, props, children: [...] }`) — natural to author by hand, but O(depth) lookups, expensive moves across containers, and no stable per-node addressing for patches or CRDT mapping.
2. **Normalized JSON** — a flat map of `nodes: Record<NodeId, PageNode>` plus named slots holding ordered ID lists. O(1) lookup by ID, patches are ID-scoped, and it maps close to 1:1 onto a `Y.Map`-based CRDT structure.
3. **HTML or JSX as canonical storage** — rejected outright: it couples storage to a rendering technology, makes safe partial mutation and diffing hard, and is a direct XSS/parsing risk for a multi-tenant CMS.

## Decision

Use a **normalized JSON document**: `nodes: Record<NodeId, PageNode>`, node children referenced through named `slots: Record<SlotName, NodeId[]>` (the default slot is called `default`), no `parent` pointer stored (derived on demand into a memoized `DocumentIndex`), random 10-character base62 node IDs (no coordination needed for paste/merge/future multiplayer), and a two-level version stamp: `schemaVersion` for the document shape and a per-type `components` version map for component prop schemas. A separate, non-canonical "authoring" tree format (`TreeNode`) is provided for templates, fixtures and tests, converted via `fromTree`/`toTree`.

## Consequences

- O(1) node lookup and cheap ID-addressed patches; `DocumentIndex` (parent/slot/index/depth) is derived and memoized rather than stored, so it can never drift out of sync with the source of truth.
- Every consumer of the tree shape (drag-and-drop, commands, validation, rendering) walks the same normalized structure — no dual code paths for "nested" vs "flat".
- Default prop values are *not* stored per node; changing a component's default is therefore a breaking change requiring a migration that writes the old default explicitly (see ADR-014).
- Sets up, without committing to, a future CRDT-backed collaboration layer (see `docs/state-management.md` §16.3) — the normalized shape maps onto `Y.Map` naturally; that is deferred to post-1.0.
