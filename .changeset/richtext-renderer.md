---
"@next-buildr/react": minor
---

Add `renderRichText(value, { platform?, converters?, diagnostics? })` and the default `richTextConverters` (PB-048): a JSON walker for the Lexical subset (paragraph, heading, list, listitem, quote, link, text with format bitmask, linebreak). Node types are an allowlist (unknown ones are dropped with `richtext.unknown-node`), links are re-sanitized and routed through `platform.Link`, depth and size are capped, and no HTML is ever injected.
