---
"@next-buildr/core": patch
"@next-buildr/react": minor
"@next-buildr/components": patch
"@next-buildr/payload": patch
---

PB-157 security review fixes (ADR-026, ADR-028). Custom CSS: `(` and `[` share one bracket stack, as in the CSS Syntax spec, so `[(])` and `([)]` are refused instead of swallowing later rules, and a `:` that is not a pseudo-class is refused in a selector. Media: `@next-buildr/react` exports `markResolvedMedia` and `isResolvedMedia`; the renderer marks only the assets it resolved from `PreparedData.media`, and the media components treat every other object with a `url` (a raw value, or the snapshot of an unprepared reference) like an external source (https and the host allowlist) or a same-origin `/path`. A present `externalMediaHosts` or `iframeHosts` that is not an array now allows no host. `buildr/video` no longer sets `referrerPolicy`, which a `video` element does not have; hosts using external video should send a page-level `Referrer-Policy`. Payload: without a `registry`, a request that may not write author code cannot add or change an `html` prop or `mode: 'html'`, `authorCode` other than `false` needs the `registry` option, and a duplicate no longer carries the source document's author code to a request that may not write it.
