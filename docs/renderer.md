# Renderer

See also [ADR-008](adr/ADR-008-renderer-architecture.md).

## Pipeline

```
load(doc) -> migrate(core + components, in memory, cached by hash) -> validate(lightweight: envelope + invariants)
          -> prepareRender(DataSource)  [async: media, queries, context]
          -> compileStyles(theme)       [CSS string, cached by hash]
          -> renderTree(...)            [sync: React elements]
```

```ts
renderTree(doc, {
  registry,               // ReactRegistry (metadata + render)
  data: PreparedData,     // media, queries, diagnostics
  context: DataContext,   // scopes, locale, timeZone, mode
  platform: Platform,     // { Link, Image, formAction(ref, nodeId) } — injected by the adapter
  instrument?: CanvasInstrumentation,   // canvas only: NodeView, data-bid, placeholders
}): ReactNode
```

Rendering a node: a falsy `visibleIf` yields `null`. Otherwise `resolveProps` runs (resolved values plus diagnostics), `root` attributes are built, slots render recursively, and `createElement(def.render, props)` is called.

## The component contract

```ts
export interface BuilderComponentProps<P> {
  props: ResolvedProps<P>;                                // resolved, validated, sanitized values
  root: { className: string; id?: string; 'data-bid'?: string; 'data-bi'?: number };  // MUST land on the root element
  slots: Record<SlotName, ReactNode>;
  children?: ReactNode;                                   // = slots.default
  node: { id: NodeId; type: ComponentType };
  env: { mode: 'production' | 'preview' | 'canvas'; locale: LocaleCode; messages: Record<string, string> };
  platform?: Platform;                                    // runtime: 'shared' only (not serializable)
}
```

`root` must be spread (`{...root}`) onto the component's root element. This is what gives the node its style class, its anchor, and (in the canvas) its identity — with **no wrapper `div`**, which would otherwise break `flex`/`grid` layouts and `> *` selectors. The dev build of the canvas runtime warns when it cannot find the expected `data-bid` element. `runtime: 'client'` components only ever receive serializable values — no `platform`, no functions, no class instances (asserted in dev); a client component does not render platform primitives itself, it receives already-rendered links/images as children or slots.

## Production vs. editor renderer

| Aspect | Production (`@buildr/react/server`) | Editor (`@buildr/react/canvas`) |
|---|---|---|
| Entry point | RSC `renderDocument` (async pipeline) | `CanvasRuntime` (client) |
| Render function | `renderTree` | The **same** `renderTree`, plus `instrument` |
| Data | `PayloadDataSource` (Local API) | `HttpDataSource` (endpoints, cached) |
| Memoization | Not needed (single render) | `NodeView` memo plus per-node subscription |
| Error boundary | Per top-level section | Per node |
| Extras | None | `data-bid`, empty-slot / unknown-component placeholders, selection overlay, click capture |
| Unknown component | `null` plus a log entry | A visible placeholder |
| Components used | **The same components, with no `if (editor)` branches** | Same |

## Server/client boundaries

`renderTree` and every `shared`-runtime component avoid hooks, context and browser APIs, so they work identically in RSC and on the client. `runtime: 'client'` components live in a `*.client.tsx` file with `'use client'`; their metadata (in a file without the directive) stays importable from the server. Components never fetch their own data — everything arrives pre-resolved via `prepareRender`, which is exactly what lets the canvas (client-rendered) run the same components as RSC. Builder-level React context is not used to pass data — it would not survive RSC — everything flows explicitly through the render walk. Server-only (async, streaming) individual components are out of MVP scope; revisited as "server islands" in v1.0+.

## Loop, slots, rich text

- **Loop** renders the `item` slot N times with an `item`/`index`/`loop` scope. React keys are `${nodeId}:${index}`. Every instance shares the same `data-bid` (editing one edits all) with `data-bi` set to the index. Anchors on instances get a `-${index}` suffix. An empty result renders the `empty` slot; the `after` slot (with a `loop` scope) hosts pagination.
- **Rich text** rendering is a JSON walker (`richTextConverters`, extensible), never `dangerouslySetInnerHTML`. See [ADR-017](adr/ADR-017-rich-text-format.md).

## `renderTree` in practice

`renderTree(doc, { registry, data, context, platform, instrument?, messages?, cache?, diagnostics?, devChecks? })` is synchronous and returns a `ReactNode`. It calls no hooks and reads no React context, so it runs identically in an RSC and in the canvas (a test calls every component without a React dispatcher, and another scans the sources).

Per node, in order:

1. `visibleIf` — `resolveVisibility`; falsy, missing data or an invalid condition renders nothing.
2. The component is looked up in the `ReactRegistry`. An unregistered type renders `null` plus a `render.unknown-component` diagnostic, or `instrument.unknownComponent(node)` in the canvas.
3. `resolveProps` with the `DataContext` (bindings, expressions, translations, fallbacks, defaults, sanitization).
4. **Media**: a `media` prop that resolves to a reference receives the asset from `data.media`; without it the reference's own `snapshot` (with `render.media-snapshot`), else the reference itself (`render.media-missing`).
5. Slots: every slot the component declares is rendered (an empty one gets `instrument.emptySlot`, else `null`) and handed over as `slots[name]`; `children` is `slots.default`. A node that contains itself stops with `render.cycle`.
6. `root`: `className` is `bc-<name> b-<id>` (`buildr/heading` is `bc-heading`; another namespace is kept, `acme/pricing-table` is `bc-acme-pricing-table`), `id` is the node's anchor, plus whatever `instrument.rootAttributes(node)` adds (`withNodeIds` adds `data-bid`).
7. `createElement(render, { node, env, root, slots, props, platform })`. `platform` is left out for `runtime: 'client'`, and with `devChecks` (on outside production) the props that cross the boundary are asserted to be plain JSON. `instrument.NodeView`, when set, wraps the element.

Nothing here throws for data problems; each is a `Diagnostic` pushed onto `options.diagnostics` (each carries `details.nodeId`).

### Loops

Any component with a `listSource` prop renders as a loop (the `buildr/loop` component, PB-060, is one). The list is read from the prop: `{ type: 'binding', path }` is resolved against the data context (it must be a list; otherwise `render.loop-source`), `{ type: 'query', spec }` uses the result `prepareRender` stored under `queryKey(nodeId, prop)` (`render.loop-query-missing` when it is absent), and a `Value` binding that already resolved to an array is used as is. An unset source is an empty list.

- `item` — rendered once per entry with `item`, `index` (from 0) and `loop` (`{ page, totalPages, total }`; a bound list is page 1 of 1) in scope, plus the `as` alias (`as: 'post'` makes `post.title` work). A nested loop's `item` shadows the outer one.
- `empty` — rendered, in the outer scope, only when the list is empty.
- `after` — rendered once with the `loop` scope, for pagination; it renders for an empty list too.
- Instances of a node all share its `.b-<id>` class and are keyed `<id>:<index>`. An anchor gets the instance path as a suffix (`row-2`, `tag-1-0` in nested loops) so ids stay unique. When the canvas instruments the render, every node inside an instance also carries `data-bi` (the innermost index) next to the shared `data-bid`; production output has neither.
- At most `MAX_LOOP_ITEMS` (1000) entries are rendered; the rest is cut with `render.loop-truncated`.

## Entry points and styles

- **`@buildr/react/server` — `renderDocument(input, options)`**: the async pipeline of [Pipeline](#pipeline) in one call. `input` is the stored document in any schema version; it is migrated (`migrateDocument`, then `migrateComponents` with the registry's steps), validated (envelope, limits, invariants), prepared through `options.dataSource`, styled (`compileStyles`) and rendered. It returns `{ element, diagnostics, collectionsUsed, readOnlyReasons }`. `element` holds the `<style>` elements and the page; it is `null` — never a throw — when the document cannot be rendered (not an object, a newer schema version, a broken envelope or invariants), with the reasons in `diagnostics` so the caller chooses a 404 or an error page. A component newer than this build is reported in `readOnlyReasons` (unsafe to edit) but the page still renders. `collectionsUsed` is the list of cache tags.
- **`@buildr/react/client` — `DocumentRenderer`** (`'use client'`): the same pipeline for single-page apps. Give it `document`, `registry`, `theme`, `context`, `platform` and either `data` (`PreparedData` from elsewhere) or `dataSource` (it prepares the data itself and shows `fallback` meanwhile; a late answer for a document that has since changed is ignored). `onDiagnostics` receives what went wrong.
- **`BuildrStyles`** (shared, no hooks): renders `compileStyles`'s result as `<style href precedence="buildr">`. React 19 hoists them into `<head>` and emits each `href` once per page. The layer order and the theme's tokens are one element (`buildr-theme-<hash>`), the node rules another (`buildr-<hash>`), so several documents on one theme send the shared part once.
- `./server` never imports `./client` (a dependency-cruiser rule); the only `'use client'` code it can reach is a registry component that declares `runtime: 'client'`.

## Rich text

`renderRichText(value, { platform?, converters?, diagnostics? })` turns a rich text value (the Lexical subset of ADR-017) into React. It walks the JSON; it never builds HTML, and nothing in the package uses `dangerouslySetInnerHTML` (a test scans the sources).

- **Allowlist.** Node types are looked up in `richTextConverters` (`root`, `paragraph`, `heading` h1–h6, `list` bullet/number, `listitem`, `quote`, `link`, `text`, `linebreak`). Anything else, including `__proto__` or `toString`, is dropped with its children and reported as `richtext.unknown-node`.
- **Text formats.** The `format` bitmask (1 bold, 2 italic, 4 strikethrough, 8 underline, 16 code, 32 subscript, 64 superscript) becomes nested `strong`, `em`, `s`, `u`, `sup`, `sub`, `code`. Text is a React child, so it is escaped.
- **Links.** The URL is checked again with `sanitizeUrl` because the value may not have passed core's normalization. An unsafe or missing URL leaves the link text without the link (`url.unsafe-scheme` diagnostic). Safe links render through `platform.Link`, or a plain `<a>` when no platform is given.
- **Limits.** Nesting deeper than `MAX_RICH_TEXT_DEPTH` and more than `MAX_RICH_TEXT_NODES` nodes are cut and reported.
- **Extending.** `converters` is merged over the defaults per call (no global registry): e.g. `@buildr/payload` adds `upload`. A converter gets the node, `ctx.children(...)` to render its children, `ctx.report(...)`, and `ctx.platform`.
