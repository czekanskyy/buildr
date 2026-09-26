---
"@next-buildr/core": minor
---

Add the CSS compiler (PB-029): `compileStyles(doc, theme)` returns the stylesheet (layer order, tokens, `@layer buildr.nodes` with `.b-<id>` rules, one `@media` block per theme breakpoint) with a content hash and diagnostics. `compileNodeRules` / `compileNodeDeclarations` compile a single node for the canvas; results are memoized on the identity of `styles` and theme. Every emitted value is re-parsed through its property grammar, so output is deterministic, contains no `!important` and nothing outside the grammar.
