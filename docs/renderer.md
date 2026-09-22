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
