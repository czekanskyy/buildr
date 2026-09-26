---
'@next-buildr/editor': minor
'@next-buildr/payload': minor
---

Editor: a visual style inspector (nested margin/padding rings with linked sides, one-row inset, border width and radius, side-by-side size/gap/typography fields, icon segments for display, alignment and text style, colour picker, opacity slider) and a unit menu on every length field instead of typing units. Insert panel categories are ordered Layout, Content, Media, Forms, UI, CMS. The toolbar shows the Buildr mark and an editable page name; the breadcrumbs no longer show the `buildr/` prefix.

`DocumentAdapter` gets an optional `rename(ref, title)`; the Payload plugin adds `PATCH /buildr/documents/:collection/:id` (renames without touching the layout or its revision) and the adapter implements `rename`.
