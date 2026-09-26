---
"@next-buildr/react": minor
---

Render data lists (PB-046): any component with a `listSource` prop is a loop. Its `item` slot is rendered once per entry under `item` / `index` / `loop` scopes (plus the `as` alias), `empty` only for an empty list, `after` once under the `loop` scope (for pagination). The list comes from a binding or from the query result in `PreparedData`. Instances share the node's `.b-<id>` class, are keyed `<id>:<index>`, get anchors suffixed with their index path, and carry `data-bi` when the canvas instruments the render. Lists longer than `MAX_LOOP_ITEMS` (1000) are cut and reported.
