---
"@next-buildr/editor": patch
---

PB-159: visual fixes round 1. The Blocks tab drops "Recently used", shows always-open sections
(Układ, Treść, Multimedia, Formularze, then any other category) in two columns (one when the
sidebar is narrower than about 272px), and the canvas stage has square corners and smaller margins.
The palette sections come from an explicit ordered list in `panels/insert/catalog.ts`; blocks the
registry lacks are skipped. The stored `buildr.editor.insert.recent` and `.collapsed` keys are no
longer read.
