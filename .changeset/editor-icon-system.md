---
"@buildr/editor": minor
"@buildr/components": minor
---

Add the editor icon system (PB-120): `Icon`, `ComponentIcon` and `componentIconNames` are exported from `@buildr/editor`, and `IconButton` now takes an icon name (`IconName`) instead of a glyph. Component icons resolve against a curated static map of lucide icons (unknown or missing names show a neutral box); the undo/redo, back, tree, select, layer-badge and list-control glyphs are now icons. New dependency: `lucide-react` (tree-shakeable, ISC; the same icon set the components package draws from). `@buildr/components`: the Textarea icon is the canonical lucide name `text-align-start` (was the alias `align-left`).
