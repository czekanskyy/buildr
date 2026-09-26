---
"@next-buildr/payload": minor
---

Templates (PB-101): the plugin adds the `buildr-templates` collection (one `isDefault` per target collection) when a collection takes templates. `resolveLayout` (`@next-buildr/payload/data`) picks the own layout, the chosen template, the default template or a built-in layout. The document response gains required `layoutSource` and `layoutRef`.
