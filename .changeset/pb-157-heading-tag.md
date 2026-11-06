---
"@next-buildr/core": patch
"@next-buildr/components": minor
---

PB-157: `buildr/heading` gets an optional `tag` prop (`heading` by default, or `p`, `span`, `div`,
`strong`) to render heading-styled text outside the outline. The `heading-order` and `empty-heading`
a11y rules skip a heading that does not render as a heading. Component version 2 (identity migration).
