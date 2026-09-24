---
"@buildr/editor": minor
---

Selection, hover and breadcrumbs (PB-075): the store gains `select` (replace, toggle, add), `clearSelection`, `moveSelection` (parent, child, next, previous), an anchor node and the selected Loop instance; a removed node leaves the selection and hover on its own. `<Breadcrumbs />` shows the path from the root to the selection.
