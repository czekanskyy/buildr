---
'@next-buildr/payload': minor
---

`createPayloadDataSource` accepts `itemPath(collection, doc, locale)`; its result is exposed to bindings as `item.path`, so a card in a Loop can link to the queried document.
