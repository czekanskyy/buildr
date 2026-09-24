# Editor

See also [ADR-009](adr/ADR-009-editor-architecture.md) and [ADR-015](adr/ADR-015-iframe-preview.md).

## Layout and modules

```
Toolbar: <- CMS | Document title | Desktop/Tablet/Mobile | Undo Redo | * Saved | Preview | Publish
Insert / Layers panel | Canvas = iframe (width = breakpoint) | Inspector (Content / Style / Advanced)
Issues panel (validation + a11y + binding diagnostics), collapsible
```

```
packages/editor/src/
  app/           BuilderEditor (root), EditorConfig, providers, layout
  store/         slices (document, history, selection, viewport, ui, persistence, canvas), selectors, dispatch
  canvas-host/   iframe mounting, transport to the parent side, patch synchronization, status/errors
  panels/
    insert/      component and template palette from the manifest, search
    layers/      the document tree (virtualized)
    inspector/   props (per-kind controls), value modes (Static/Dynamic/Formula), styles, advanced, a11y
    issues/
  toolbar/
  dnd/           pointer-event engine, sources (palette, tree), iframe overlay, forwarding
  shortcuts/     scoped keyboard shortcut registry
  clipboard/
  persistence/   DocumentAdapter (types), autosave, conflict resolution
  ui/            UI primitives (Radix wrappers), editor tokens.css
```

**Mount API**:

```tsx
<BuilderEditor
  adapter={documentAdapter}          // DocumentAdapter: load/save/publish/media/dataSchema/session
  manifest={manifest}                // RegistryManifest (from the server, or from the registry directly in the playground)
  canvasUrl="/buildr/canvas"         // the canvas route (same-origin in MVP)
  documentRef={{ collection: 'pages', id: '123' }}
  config={{ breakpoints, shortcuts, autosave: { debounceMs: 2000, maxWaitMs: 20000 } }}
/>
```

## Iframe vs. rendering inside the editor's own tree

| Criterion | Iframe (a real Next.js page route) | Rendering inside the editor's React tree |
|---|---|---|
| Production fidelity | Same renderer, the site's own global CSS, fonts, layout, providers | Site CSS would need loading into the editor, colliding with editor CSS |
| Media queries / responsive | Native (iframe width = viewport) | Media queries respond to the editor window, forcing a rewrite to container queries |
| CSS/JS isolation | Full (a separate document) | Style leakage in both directions, global reset conflicts |
| Custom client components | Behave exactly as on the site | Share a runtime with the editor — a broken component can crash the editor |
| Communication complexity | postMessage, async, a protocol | Direct calls, simpler |
| Overlays / drag-and-drop | An overlay drawn inside the iframe, palette drag forwarded in | Straightforward |
| Performance | Two React trees, patch serialization (cheap) | One tree |
| Security | Requires origin/source validation | No boundary to defend |

**Decision: iframe.** Fidelity, native media queries and isolation are non-negotiable for a builder targeting production client sites, and they are extremely expensive to fake without one. The protocol/overlay/drag-and-drop cost is one-time and well-testable. Document state lives **only** in the editor; the canvas keeps a read-only replica and every change always goes through a command dispatched in the editor.

## Canvas runtime (inside the iframe, `@buildr/react/canvas`)

- Handshake and document/patch ingestion. A local replica plus a small per-node-subscribable store.
- Rendering via `renderTree` with instrumentation: `NodeView` (memoized, per-node error boundary, `data-bid`/`data-bi` forwarded through `root`), empty-slot placeholders, unknown-component placeholders.
- Interaction capture in the capture phase: a click selects a node instead of navigating a link or submitting a form; hover highlights; a double-click enables inline editing; context menu requests are forwarded to the editor.
- An overlay (Shadow DOM, `position: fixed`, updated on `requestAnimationFrame` during scroll/resize): selection/hover outlines, a type label, a drag handle, an outline around every Loop instance. `ResizeObserver` only watches the selected and hovered elements.
- Selecting a node inside a collapsed `<details>` opens its `<details>` ancestors generically, with no per-component special-casing.
- Hit-testing for drag-and-drop (`elementsFromPoint`, following `data-bid` up to the root with rects and the layout axis) plus drawing the insertion indicator.
- Data: an `HttpDataSource` (context, queries, media) with caching and a 300ms debounce.
- Forwarding keyboard shortcuts (outside text fields) and reporting errors/diagnostics.

### How the canvas runtime works (PB-067)

`CanvasRuntime` is one component: give it the registry, the theme, the platform and the allowed editor origins, and it is the whole canvas page. Its parts:

- **Store** (`createCanvasStore`): the replica of the document and the rest of what the editor sent (selection, hover, viewport, mode, locale). It is subscribable as a whole and **per node**; the document is replaced only through `editor:init`, `doc:set` or `doc:patch` (`applyDocumentPatches`, which shares every node a patch did not touch, so a node's identity says whether it changed).
- **Handshake**: `canvas:hello` is sent every 500 ms (40 times at most) until `editor:init` arrives; `canvas:ready` follows the first commit that has the data of the document. Each further `editor:init` is answered the same way.
- **Versions**: a `doc:patch` is applied only when its `from` is the version the canvas has. A newer `from` (a message was lost) or a patch that does not fit the document sends `doc:resync-request { have }` **once**, and later patches are ignored until the editor answers with `doc:set`. A patch to a version the canvas already has is dropped.
- **Rendering**: `renderNodeAt` with `instrument.lazyChild` (docs/renderer.md#the-canvas-renders-node-by-node). Each node is a `NodeView`: memoized, subscribed to its own node, wrapped in its own error boundary. Editing one prop re-renders that node's component and nothing else; inserting a node re-renders its parent and the new node.
- **Placeholders**: a component that throws is replaced by a `[data-buildr-placeholder="error"]` element that keeps `data-bid` (so it can still be selected and deleted) and reported as a non-fatal `canvas:error` with its `nodeId`; it renders again as soon as its node changes. An unregistered component shows `[data-buildr-placeholder="unknown"]` with its type, and an empty slot (in edit mode) shows the text from the component's `editor.emptySlotText` — the canvas has no strings of its own.
- **Diagnostics**: what each node's render reports is kept per node and sent as one `diagnostics` message (coalesced, and only when it changed). `window.onerror` and `unhandledrejection` are sent as `canvas:error`.
- **Data**: `prepareRender` runs when the document is replaced (`editor:init`, `doc:set`) and when the context or locale changes. It does not run for a patch: debouncing and caching by query spec is PB-071.
- The channel is `connect()` (a `createChildTransport` on the canvas's own window by default; `session` comes from `?session=`). The runtime owns it and closes it on unmount.

### Selection, hover and the overlay (PB-068)

`CanvasRuntime` installs both by default (`interactive={false}` turns them off):

- **Capture** (`installInteractions`): capture-phase listeners on the document. In `edit` mode a primary-button click is stopped (`preventDefault`, `stopPropagation`, `stopImmediatePropagation`) whether or not it is on a node, so no link navigates and no button runs the site's handler; on a node it sends `node:click` with the node's `data-bid`, the Loop repetition (`instance`: the `data-bi` indices from the outermost loop, joined with `.`) and the modifier keys. `dblclick` sends `node:dblclick`; `mouseover` sends `node:hover` once per change of node (`null` when the pointer leaves the page); a `submit` is cancelled. In `interact` mode nothing is captured.
- **Overlay** (`createOverlay`): a `position: fixed`, `pointer-events: none` host with a shadow root, appended to `<body>`, so the site's CSS does not reach it and it takes no part in the site's layout. It outlines the selected nodes (solid, with the node type as a label) and the hovered one; a node rendered once per Loop repetition is outlined once per repetition, the first solid and the rest dashed. Boxes are read with `getBoundingClientRect` (viewport-relative, so fixed and sticky elements are right) and redrawn on the next animation frame after a scroll, a resize, or a change of selection, hover or document; a `ResizeObserver` watches only the outlined elements.
- Selecting a node inside a collapsed `<details>` opens its `<details>` ancestors, for any component.
- Outside production, a selected node with no `data-bid` element logs one warning: it cannot be outlined.

## The postMessage protocol

An **envelope**, Zod-validated on both sides (malformed messages are dropped and logged in dev):

```ts
interface Envelope<T extends string, P> {
  source: 'buildr'; protocol: 1; session: string;   // session: a random nonce from the canvas URL, confirmed at handshake
  id?: string; replyTo?: string;                    // request/response
  type: T; payload: P;
}
```

**Handshake**: the editor creates `iframe src="{canvasUrl}?session={nonce}"` and waits up to 10s; the canvas posts `canvas:hello { protocol, rendererVersion, manifestHash }` to `window.parent` with an explicit `targetOrigin` (never `'*'`); the editor checks `event.origin`, `event.source === iframe.contentWindow`, the session and the protocol version, then compares `manifestHash`; the editor sends `editor:init { doc, docVersion, selection, viewport, contextRef, locale, locales, mode }`; the canvas renders and replies `canvas:ready`. A timeout or mismatch shows a diagnostic error screen (wrong URL, `frame-ancestors` CSP, origin, version).

| Direction | Type | Payload | Notes |
|---|---|---|---|
| E->C | `editor:init` | doc, docVersion, selection, viewport, contextRef, locale, locales | idempotent (safe on canvas reload) |
| E->C | `doc:patch` | `{ from, to, patches }` | Immer patches; a version gap triggers `doc:resync-request` |
| E->C | `doc:set` | `{ doc, docVersion }` | full document (init, resync, conflict resolution) |
| E->C | `selection:set` / `hover:set` | `{ ids }` / `{ id \| null }` | |
| E->C | `viewport:set` | `{ breakpoint, width }` | the iframe resizes itself; this message just informs editor-side logic |
| E->C | `context:set` | `{ contextRef }` | switching sample data for a template |
| E->C | `locale:set` | `{ locale }` | switch the content language |
| E->C | `dnd:over` / `dnd:leave` | `{ point, item }` | forwarding a palette/tree drag |
| E->C | `scroll:to` | `{ id }` | |
| E->C | `mode:set` | `{ mode: 'edit' \| 'interact' }` | `interact` lets clicks reach components (v0.2) |
| C->E | `canvas:hello` / `canvas:ready` | | |
| C->E | `doc:resync-request` | `{ have: docVersion }` | the editor replies with `doc:set` |
| C->E | `node:click` / `node:hover` / `node:dblclick` | `{ id, instance?, modifiers }` | |
| C->E | `inline:commit` | `{ id, prop, value }` | -> `node.setProp` |
| C->E | `dnd:target` | `{ target \| null, reason? }` | reply to `dnd:over` |
| C->E | `intent:move` | `{ ids, target }` | drag started inside the canvas |
| C->E | `key:down` | `{ key, code, mods }` | shortcuts |
| C->E | `contextmenu` | `{ id, point }` | point translated to editor coordinates |
| C->E | `diagnostics` | `{ items: Diagnostic[] }` | bindings, per-node render errors |
| C->E | `canvas:error` | `{ message, nodeId?, fatal }` | fatal shows a "Reload canvas" affordance (lossless) |

### Schemas (`@buildr/core/protocol`)

Every message of the table above has a Zod schema (`editorMessageSchema` for what the editor sends, `canvasMessageSchema` for what the canvas sends, `messageSchema` for both), and a test keeps this table and the schemas identical. All schemas are strict (an unknown field refuses the message).

- `parseEditorMessage`, `parseCanvasMessage`, `parseMessage` take whatever arrived in a `MessageEvent` and return a `Result`; a refused message is one `protocol.invalid-message` diagnostic and is never thrown. `parseEnvelope` reads just the envelope, and accepts any protocol version so that a `canvas:hello` of another version can be told apart from noise.
- `createMessage(type, payload, { session, id?, replyTo? })` builds a typed message. `MESSAGE_DIRECTION` says which side sends each type, so a receiver drops a type its peer may not send.
- `PROTOCOL_VERSION` is 1 and is in every envelope. Changing the shape or meaning of any message bumps it in the same change.
- The session is 16 to 128 URL-safe characters; `id` and `replyTo` are 1 to 64.
- `doc:patch` carries Immer patches with JSON values only, at most 10 000 patches of at most 24 path segments, and no path segment may be `__proto__`, `constructor` or `prototype`. Its `to` must be later than `from`. `doc:set` and `editor:init` carry a document that must pass `documentSchema` (the canvas still runs the document limits on it).
- Other limits: 1000 ids in a selection or a move, 500 diagnostics, 20 000 characters of inline text, a viewport width of 240 to 4096, a prop name of letters, digits and `_` (never a prototype key).

### Transports (`@buildr/core/protocol`)

`createParentTransport({ iframe, canvasOrigin, session, host? })` is the editor's end and `createChildTransport({ allowedOrigins, session, host?, parent? })` the canvas's. Windows are passed in as small interfaces (`WindowLike`, `PostTarget`, `FrameLike`); `host` and `parent` default to `window` and `window.parent`, so `@buildr/core` itself has no DOM types. Both return a `Transport`:

- `send(type, payload)` returns `false` when there is no window to send to. `request(type, payload, { timeoutMs })` resolves with the answer (matched by `id` and `replyTo`) or rejects with a `TransportError` (`timeout` after 5 s by default, or `closed`). `reply(message, type, payload)` answers a request. `on(type, handler)` returns the function that removes it. `close()` stops listening and fails pending requests.
- What each side may send and receive is in the types: the editor sends `EditorMessage`s and receives `CanvasMessage`s.

Every incoming message is checked in this order, and dropped at the first failure (`onReject` gets `{ reason, origin }`, for logging in development): **origin** (equal to `canvasOrigin`, or in `allowedOrigins`), **source** (the frame's current `contentWindow`, or `window.parent`, by identity), **envelope** (`source: 'buildr'`, a well-formed session), **session** (equal to ours), **version** (`version` reports the peer's number, so the editor can name it in the error screen), **schema**, **direction** (a valid message of a type this peer may not send). An answer to a request that is no longer waiting is `stale-reply`. A handler that throws goes to `onError` (or is rethrown from a timer) and does not stop the other handlers.

Messages are posted only to a concrete origin: the option values are validated at creation (`'*'`, `'null'`, paths and wildcards throw), and the one function that posts refuses `'*'` whatever it is given. The canvas does not know which allowed origin the editor has until it speaks: before that it addresses each allowed origin (the browser delivers to the matching one only); after the first valid message it addresses that one and refuses the others. A canvas that is not inside a frame throws when creating its transport.

**Synchronization**: the editor is the source of truth. Every command produces patches, batched once per animation frame. The canvas applies them with `applyPatches` to its own replica; structural sharing preserves identity for unchanged nodes, so only what actually changed re-renders. Undo/redo sends inverse patches through the same channel. Selection/hover state lives in the editor; the canvas is purely a receiver, and a click in the canvas sends an intent rather than mutating local state. A canvas reload (HMR, navigation, crash) simply re-sends `canvas:hello`; the editor replies with `editor:init` carrying current state, so state loss is impossible by construction. A component error is caught by a per-node error boundary (a placeholder plus a non-fatal `canvas:error`); `window.onerror`/`unhandledrejection` are also reported; no handshake reply shows the error screen. See [security.md](security.md) for the origin/source/nonce/CSP details.

## Drag and drop, editing features, state and commands

See dedicated pages: [drag-and-drop.md](drag-and-drop.md), [state-management.md](state-management.md), [commands.md](commands.md).
