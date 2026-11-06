---
"@next-buildr/core": minor
"@next-buildr/mcp": patch
---

PB-157 (ADR-027): a typed, CSS-only `motion` style group (entrance, hover, scroll reveal and
parallax) with enums and bounded numbers, compiled to scoped `@keyframes`, transitions and
`animation-timeline` behind `@supports`, all inside `prefers-reduced-motion: no-preference`. No
runtime script. `compileStyles` also returns each node's `NodeRules.motion` and `keyframes`.

PB-157 (ADR-026): trusted author code, off by default. `PageNode` gains optional `customCss`,
`classes` and `attributes`, set through `node.setAttr`, and `textarea` props gain `format: 'html'`.
All of it needs `capabilities.authorCode === true` on `CommandEnv` (`command.author-code-not-permitted`
otherwise; core fails closed when the field is absent), and `compileStyles(doc, theme, { capabilities })`
and `authorNodeAttributes` ignore it without the capability. Custom CSS is parsed by a strict in-house
reader, scoped to the node and emitted into `@layer buildr.custom`; `@import`, `url()`, other at-rules,
escapes and sibling combinators are rejected; CR, CRLF and FF count as newlines (they end a string, as
in a browser) and other control characters are refused. `node.setProp`, `node.insert`, `node.wrap`
and `node.duplicate` apply the same capability rule to HTML props and copied author code, and
attribute names starting `data-b` (Buildr's canvas markers) are reserved. New exports: `HostCapabilities`, `authorCodeEnabled`,
`compileCustomCss`, `sanitizeHtml`, `sanitizeHtmlToString`, `authorNodeAttributes`, `checkAuthorCode`.

New runtime dependency `parse5` in `@next-buildr/core`, only for the Text `html` sanitiser
(`core/author/html.ts`): untrusted markup must be parsed the way a browser parses it before an
allowlist is applied, and a regex or hand-written HTML parser is not safe enough for that. It has no
dependencies of its own that matter here, runs in Node and the browser, and nothing else imports it.
The mcp package only explains the new command error code and lists the `motion` group.
