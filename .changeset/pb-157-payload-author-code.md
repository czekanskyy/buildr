---
"@next-buildr/payload": minor
---

PB-157 (ADR-026): new `authorCode` plugin option (`false` by default, `true`, or
`({ req }) => boolean | Promise<boolean>` resolved per request; never granted to API-key requests).
Every write of a layout (the `layout` field hook, the save endpoint and `buildr-templates`) now runs
`checkAuthorCode`: without the capability a save is rejected (`author.not-permitted`) when it adds or
changes a node's custom CSS, classes, attributes or HTML props, while author code already stored can
be saved unchanged or removed. With it, the code is still checked against its rules. `processLayout`
(exported) gains `allowAuthorCode` and `previous` options and rejects all author code without them.
