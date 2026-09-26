---
'@next-buildr/editor': patch
'@next-buildr/payload': patch
---

The canvas binds against the document's own data by default and against the chosen sample: `LoadedDocument.contextRef` (from the Payload adapter) is the initial canvas context, and `listSamples` ids are `collection:id`.
