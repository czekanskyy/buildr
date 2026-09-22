# ADR-018: Data fetching

**Status:** Accepted

## Context

Components that display lists or media (Loop, Image bound to a relation) must not each independently fetch data — that path leads to N+1 queries, no batching, and SSR/CSR divergence — while still keeping component authoring declarative.

## Options

1. **Data fetching inside components** (hooks/async components per component) — the natural React pattern, but defeats batching and makes canvas-vs-production parity fragile.
2. **A declarative `QuerySpec` per data-consuming prop, resolved in one upfront pass (`prepareRender`) before rendering starts**, backed by a pluggable `DataSource` interface.

## Decision**

Every data-consuming prop declares its need declaratively (a `BindingValue` path, or a `QuerySpec` on a `listSource` prop like `Loop.source`). Before `renderTree` runs, `prepareRender(doc, registry, ctx, dataSource)` walks the document once, batches all media lookups into a single `getMedia(ids)` call and issues all `Loop` queries with bounded concurrency, producing a single `PreparedData` object. `DataSource` is an interface implemented by `PayloadDataSource` (server, Local API), `HttpDataSource` (canvas, via plugin endpoints) and `MemoryDataSource` (playground/tests) — validated identically by a shared contract test suite.

## Consequences

- No N+1 query patterns; cache tags for revalidation are collected as a byproduct (`collectionsUsed`).
- Components stay pure view functions — they receive already-resolved values, never a data client.
- MVP explicitly disallows a `Loop` query that depends on the enclosing `item` (nested dependent queries) to keep the batching model simple; revisited post-MVP if a real use case demands it.
