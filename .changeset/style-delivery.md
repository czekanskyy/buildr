---
"@next-buildr/react": minor
---

Add the `./server` and `./client` entry points and style delivery (PB-047). `BuildrStyles` renders a document's stylesheet as React 19 `<style href precedence>` elements, split into the layer order + theme tokens (sent once per page) and the node rules (keyed by the compiled hash). `@next-buildr/react/server` exports `renderDocument(input, options)`, the async `migrate -> validate -> prepareRender -> compileStyles -> renderTree` pipeline, returning `{ element, diagnostics, collectionsUsed, readOnlyReasons }` (`element` is `null` for a document that cannot be rendered). `@next-buildr/react/client` exports `DocumentRenderer` (`'use client'`), which takes `PreparedData` or a `DataSource`. A dependency rule keeps `./server` from importing `./client`.
