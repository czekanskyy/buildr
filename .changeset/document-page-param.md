---
"@next-buildr/payload": patch
---

`getBuildrDocument` accepts `page` and exposes it as `route.params.page` (part of the cache key), so a paginated listing such as `/blog/page/2` loads its own page of results (PB-112).
