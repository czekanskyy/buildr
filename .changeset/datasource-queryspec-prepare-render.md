---
"@next-buildr/core": minor
---

Add `DataSource`, `QuerySpec` and `prepareRender` (PB-026): the `DataSource` interface (`getMedia`, `query`) with `MediaRef`/`MediaAsset`/`QueryResult` and Zod schemas; `querySpecSchema` / `resolvedQuerySpecSchema` with filter limits; `resolveQuerySpec`; `prepareRender`, which batches all static media lookups into one call, runs Loop queries with a concurrency cap of 4, collects `collectionsUsed` and rejects queries that depend on the enclosing loop item, returning a fully serializable `PreparedData`; `createMemoryDataSource`; and `collectPathRoots` for expressions.
