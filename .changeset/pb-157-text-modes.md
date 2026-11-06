---
"@next-buildr/components": minor
---

PB-157 (ADR-026, ADR-027): `buildr/text` gets `mode` (`plain` by default, `rich`, `html`) with the
props `rich` (rich text) and `html` (author HTML). `plain` is the old behaviour; `rich` and `html`
render a `div`. `html` renders core's sanitised tree through `createElement` (no
`dangerouslySetInnerHTML`) and only when the host's `authorCode` capability is on; otherwise it shows
the plain `text`. Component version 2 (identity migration: a stored text has no `mode`, which already
means plain). Every component that had `effects` except the form controls now also has the `motion`
style group.
