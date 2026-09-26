---
"@next-buildr/core": minor
---

Add themes and design tokens (PB-028): `defineTheme` / `validateTheme` (breakpoints listed widest first with strictly decreasing widths, token naming rules, every token value checked by its scale's grammar including new shadow, font-family and transition grammars), `defaultTheme`, `compileTokens` (deterministic `@layer buildr.tokens` custom properties), `resolveTokenRef` and `LAYER_ORDER_CSS`.
