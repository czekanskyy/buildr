# @next-buildr/react

## 1.0.0

### Minor Changes

- 61f56e7: Add `defineComponent` and `createRegistry` (PB-044): a component is its serializable metadata plus `render`, `runtime` and `migrations` (`{ [toVersion]: (props, ctx) => props }`, validated to be contiguous up to `version`). `createRegistry({ components, templates? })` builds an immutable `ReactRegistry` whose `meta` is a core `RegistryMeta` (so `toManifest`, `canInsert`, `validateDocument` see the metadata unchanged), with `get`/`has`/`list`, `migrations` for `migrateComponents`, and `extend`. Exports the component contract types `BuilderComponentProps`, `ClientComponentProps` (no `platform`), `NodeRoot`, `Platform`.
- 5e09ff6: Render data lists (PB-046): any component with a `listSource` prop is a loop. Its `item` slot is rendered once per entry under `item` / `index` / `loop` scopes (plus the `as` alias), `empty` only for an empty list, `after` once under the `loop` scope (for pagination). The list comes from a binding or from the query result in `PreparedData`. Instances share the node's `.b-<id>` class, are keyed `<id>:<index>`, get anchors suffixed with their index path, and carry `data-bi` when the canvas instruments the render. Lists longer than `MAX_LOOP_ITEMS` (1000) are cut and reported.
- e8ac326: Canvas overlay polish (PB-130): accent hover and selection outlines, a label chip (component label and node name) that flips inside the node at the viewport edge, accent drop lines and "inside" highlights, and dashed empty-slot placeholders, all from a fixed `--buildr-*` variable set inside the canvas. `createOverlay` accepts an optional `labelOf`; `computeBoxes` an optional third argument. No protocol change.
- 1575afe: Canvas data: `createDataPreparer` / `dataKey` re-run `prepareRender` only when the media or query specs (or locale, context) change, debounced 300 ms and cached by spec; `CanvasRuntime` gains `loadScopes`, and `dataLoading` in the store (PB-071).
- 55befc3: Canvas drag and drop: `buildHitPath`, `createDndController` (`dnd:over`/`dnd:leave` → `dnd:target`, drop indicator and refusal reason in the overlay, handle-driven moves with autoscroll sending `intent:move`) (PB-070).
- e5c2180: Canvas: `installForwarding` sends the editor's keyboard shortcuts (`key:down`) and right clicks (`contextmenu`) from the iframe, never from text fields or inline edits (PB-072).
- 0af8fef: Canvas: inline text editing on double click for `editor.inlineProp` (static strings), committed once with `inline:commit` on Enter or blur, cancelled with Escape, with the node's view frozen while editing (PB-069).
- 8ab4fbe: Canvas: click, double-click, hover and submit capture in edit mode, and a Shadow DOM overlay outlining the selection and hover (per Loop instance), with auto-opening `<details>` and a dev warning for a missing `data-bid` (PB-068).
- 7894e77: Adds `CanvasRuntime` to `@next-buildr/react/canvas`: the canvas's handshake, document replica with version-gap resync, per-node rendering (`renderNodeAt`, `instrument.lazyChild`), per-node error boundaries, placeholders and diagnostics reporting (PB-067). The protocol's patch limit now matches `applyDocumentPatches` (10 000).
- d145516: Components receive `env.layoutRef`; `renderDocument`, `RenderTreeOptions` and `DocumentRenderer` accept `layoutRef` (PB-061).
- 1453d2e: Components receive `node.parent` (`{ id, type, props }`): their container and its resolved props (PB-059). Exports the `NodeParent` type.
- 9504f2a: The 0.1.0 MVP release: the document model, the renderer, the standard components and templates, the visual editor, and the Next.js and Payload integrations, with the reference application and its end-to-end tests.
- 5a69090: Add `renderTree(doc, { registry, data, context, platform, instrument?, messages?, cache?, diagnostics? })` (PB-045), the one renderer for production and the canvas: walks the tree, resolves props and `visibleIf` with core, renders slots recursively, and creates each component with `root` attributes (`bc-<name> b-<id>`, the anchor as `id`) and no wrapper elements. Media props receive the prepared asset from `PreparedData.media`. Unknown components render nothing (or the canvas placeholder) and every problem is pushed onto the `diagnostics` sink. `CanvasInstrumentation` (`rootAttributes`, `NodeView`, `unknownComponent`, `emptySlot`) and `withNodeIds` are the canvas extension points; a dev-mode guard asserts client components receive serializable props.
- 6021ce8: Add `renderRichText(value, { platform?, converters?, diagnostics? })` and the default `richTextConverters` (PB-048): a JSON walker for the Lexical subset (paragraph, heading, list, listitem, quote, link, text with format bitmask, linebreak). Node types are an allowlist (unknown ones are dropped with `richtext.unknown-node`), links are re-sanitized and routed through `platform.Link`, depth and size are capped, and no HTML is ever injected.
- b3fa4e1: Add the `./server` and `./client` entry points and style delivery (PB-047). `BuildrStyles` renders a document's stylesheet as React 19 `<style href precedence>` elements, split into the layer order + theme tokens (sent once per page) and the node rules (keyed by the compiled hash). `@next-buildr/react/server` exports `renderDocument(input, options)`, the async `migrate -> validate -> prepareRender -> compileStyles -> renderTree` pipeline, returning `{ element, diagnostics, collectionsUsed, readOnlyReasons }` (`element` is `null` for a document that cannot be rendered). `@next-buildr/react/client` exports `DocumentRenderer` (`'use client'`), which takes `PreparedData` or a `DataSource`. A dependency rule keeps `./server` from importing `./client`.

### Patch Changes

- 1ba33ad: Rename the npm scope from @buildr to @next-buildr
- Updated dependencies [4bdbb99]
- Updated dependencies [82bdd80]
- Updated dependencies [037287f]
- Updated dependencies [1190b2c]
- Updated dependencies [29589ff]
- Updated dependencies [71575c7]
- Updated dependencies [d145516]
- Updated dependencies [db7cd10]
- Updated dependencies [b15291b]
- Updated dependencies [96db603]
- Updated dependencies [e158655]
- Updated dependencies [89f165d]
- Updated dependencies [c10493a]
- Updated dependencies [d761eef]
- Updated dependencies [ee256d5]
- Updated dependencies [037be06]
- Updated dependencies [c507cb0]
- Updated dependencies [c18c6ad]
- Updated dependencies [4beb4f2]
- Updated dependencies [b2bb3ed]
- Updated dependencies [d5e8202]
- Updated dependencies [f238e41]
- Updated dependencies [0533292]
- Updated dependencies [890b443]
- Updated dependencies [a573b16]
- Updated dependencies [0a9cf21]
- Updated dependencies [9608646]
- Updated dependencies [a23e2d8]
- Updated dependencies [180b576]
- Updated dependencies [7894e77]
- Updated dependencies [d4b20af]
- Updated dependencies [9504f2a]
- Updated dependencies [1ba33ad]
- Updated dependencies [27a98e1]
- Updated dependencies [bbd0e13]
- Updated dependencies [98682f1]
- Updated dependencies [89cadd5]
- Updated dependencies [3ec3fce]
- Updated dependencies [6d61340]
- Updated dependencies [00075b9]
- Updated dependencies [8927bba]
- Updated dependencies [2402292]
- Updated dependencies [b466583]
- Updated dependencies [d1a8c6f]
- Updated dependencies [024fc96]
  - @next-buildr/core@1.0.0
