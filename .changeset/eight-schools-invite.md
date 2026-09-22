---
"@buildr/core": minor
---

Add `DocumentIndex` and tree traversal (PB-008): `createIndex(doc)` derives memoized parent/slot/index/depth relationships and document order for every reachable node; `walk`, `ancestors`, `pathTo`, `descendants`, `subtreeIds`, and `isAncestor` build on it for common tree queries.
