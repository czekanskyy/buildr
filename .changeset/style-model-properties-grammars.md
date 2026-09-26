---
"@next-buildr/core": minor
---

Add the style model, property registry and value grammars (PB-027): `NodeStyles` / `StyleDecl` types (now the type of `PageNode.styles`), `stylePropertyRegistry` with an entry for every property in the style model, `parseStyleValue` (token, length, color, gradient, enum and number grammars that re-render a validated value as safe CSS and reject `url()`, `var()`, `calc()`, `expression()`, `!important`, semicolons, braces and more), and `nodeStylesSchema` to validate a node's styles.
