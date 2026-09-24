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

## The shell (`@buildr/editor`, PB-073)

`<BuilderEditor adapter manifest canvasUrl documentRef config />` fills its container (give it a height) and renders the layout above: a toolbar, the left panel, the canvas and the inspector between two **resizable splitters**, and the collapsible issues bar. The panels are slots (`EditorLayout`'s `toolbar`, `left`, `center`, `right`, `issues`) that the following tasks fill; the props are already the final mount API. In the playground it is mounted at `/editor`.

- **Splitters** follow the WAI-ARIA window splitter pattern: `role="separator"` with `aria-valuenow/min/max`, dragged with a pointer or moved with the arrow keys (16 px), Home and End. The left panel is 200-480 px, the right one 240-520 px.
- **Interface strings** are never written into components: every one is a key of the catalog in `messages/en.ts`, translated in `messages/pl.ts` (a missing Polish key is a type error), read with `useT()`. `config.uiLocale` picks the language (`en` or `pl`, English for any other); it is the language of the *editor*, not of the content (docs/i18n.md).
- **Theme**: tokens are CSS variables scoped to `.buildr-editor`, light and dark. The scheme follows the system's, or is forced with `config.theme`. Import `@buildr/editor/styles.css` once in the host.
- **UI primitives** (`Button`, `IconButton`, `Input`, `Select`, `Tabs`, `Popover`, `Dialog`, `Tooltip`, `Toggle`) wrap Radix UI: keyboard, focus management and ARIA come from Radix, the looks from the tokens. An `IconButton` requires a `label` (its accessible name and tooltip).
- Every region is a landmark with a translated name (`role="toolbar"`, `aside`, `main`, `section`); the shell is checked with axe in the tests.

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
- Data: any `DataSource` (the `HttpDataSource` in the apps), fetched by `createDataPreparer` with a 300ms debounce and a cache keyed by what is asked for.
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

### Inline editing (PB-069)

A double click on a component whose `editor.inlineProp` names a prop holding a **static, non-localized string** makes the component's root element editable in place (`installInlineEdit`; `contenteditable="plaintext-only"`, or `true` plus pasting as plain text where the browser has no `plaintext-only`). The double click still reaches the editor as `node:dblclick`.

- **Enter** (without Shift) or **leaving the element** sends `inline:commit { id, prop, value }` — once, and only when the text changed; the editor turns it into one `node.setProp` and so one history entry. **Escape** puts the old text back and sends nothing. Text over 20 000 characters is not sent.
- The node's view is **frozen** for the session (`store.beginEdit`): typing re-renders nothing, so the caret never moves, and a patch that arrives mid-edit reaches the replica but is not shown until the session ends (then the latest state is).
- A click inside the text being edited places the caret and is not reported as a selection. Nothing is editable in `interact` mode, for a bound or localized value, or for a component with no `inlineProp`.

### Drag and drop in the canvas (PB-070)

`createDndController` (`@buildr/react/canvas`) is the canvas half of docs/drag-and-drop.md:

- **`buildHitPath(document, point, store)`** finds the nodes under a point with `elementsFromPoint`, follows `data-bid` up to the root and returns one `HitEntry` per node, deepest first: its box, its layout axis (`display`/`flex-direction` from the computed style: a flex row is `x`, a flex column and block flow are `y`, grid is `grid`), the boxes of its children in slot order (a Loop's first repetition only) and the boxes of its empty-slot placeholders. Coordinates are the canvas viewport's.
- **`dnd:over`** (an item dragged in from the palette or the layers panel) runs `computeDropTarget` and draws the result in the overlay: a 2px line, a highlighted container for an empty slot, or, when nothing accepts the item, a red box on the node under the pointer carrying the refusal's message. It answers `dnd:target { target, reason? }` — once per change, although the editor sends `dnd:over` every frame. `dnd:leave` clears the indicator. Nothing happens in `interact` mode.
- **Moving inside the canvas**: the selected node (never the root) has a handle in the overlay. Pressing it captures the pointer, shows the same indicator for `{ kind: 'nodes', ids }`, autoscrolls within 48px of the top or bottom edge, and on release sends `intent:move { ids, target }` when there is a target; Escape or a release over a refused spot sends nothing.

### Data in the canvas (PB-071)

The runtime takes any `DataSource` (`dataSource`), and `createDataPreparer` decides when `prepareRender` runs:

- **Replaced document or new context** (`editor:init`, `doc:set`, `context:set`, `locale:set`): fetched at once, nothing cached is reused. `context:set`/`locale:set` also call the optional `loadScopes(contextRef, locale)`, whose result becomes `DataContext.scopes` (`page`, `route`, ...); `ctx.locale` switches with the locale.
- **A patch**: `dataKey` — the static media refs and query specs of every node, the aliases of the Loops around them, the locale, the mode and the scopes — is compared with the last one. **Unchanged (an edit to text, styles, order): no request at all.** Changed: the request waits for 300 ms without a further change (`DEFAULT_DATA_DEBOUNCE_MS`), and a key seen before (the last 8) is answered from the cache immediately.
- **While it loads** the canvas keeps rendering the last data and `store.getState().dataLoading` is `true`; only the answer to the latest request is shown. A failing source becomes diagnostics (`data.source-error`, `canvas.data-failed`, `canvas.context-failed`) and the document renders without that data.

### Shortcut and context-menu forwarding (PB-072)

While the focus is inside the iframe the editor would not see the keyboard, so `installForwarding` sends it what it handles:

- **`key:down { key, code, mods }`** for Ctrl/Cmd + Z, Y, C, X, V, D, A or S, Delete, Backspace, Escape and Alt + Up/Down. A forwarded key gets `preventDefault`, so the browser does not also act on it (Ctrl+Z is not the browser's undo, Ctrl+S does not save the page); a held key is sent once. The list stays clear of the browser's own shortcuts (Ctrl+R/W/T/L/F/P, F5, F12 …), which are never captured.
- **Never from a text field or from text being edited in place** (`input`, `textarea`, `select`, `contenteditable`, an inline-edit session): there the keys belong to the text. Nothing is forwarded in `interact` mode.
- **`contextmenu { id, point }`** on a right click: the node under it (or `null`) and the pointer's position in the canvas viewport (the editor adds the iframe's offset and zoom); the browser's menu does not open, except in a text field or text being edited.

### Selection, hover and breadcrumbs (PB-075)

The selection lives in the editor store (`selectedIds`, `anchorId`, `selectedInstance`, `hoveredId`); the canvas reports clicks and hovers, the host turns them into `store.select(id, { mode, instance })` (`replace`; `toggle` with Ctrl/Cmd; `add` with Shift) and `store.setHovered(id)`. The anchor is the last node selected: the inspector shows it and keyboard moves start from it. `store.moveSelection('parent' | 'child' | 'next' | 'previous')` steps through the tree (siblings across all slots, no wrapping) and returns the node now selected. After every change to the document, undo, redo or a replacement, nodes that no longer exist drop out of the selection and the hover, and the anchor moves to the last one left. `<Breadcrumbs />` lists the path from the root to the anchor; a button selects its node and hovering it highlights that node on the canvas.

### The canvas host (PB-076)

`packages/editor/src/canvas-host`. `createCanvasHost({ store, transport, manifestHash, locales, breakpoints, … })` is the editor's end of the channel; `<CanvasFrame canvasUrl manifestHash locales breakpoints />` creates the iframe (`?session=` is a fresh 128-bit nonce), the `createParentTransport` for it and the host, and shows the status screens. The host holds no document: the store is the truth.

- **Handshake.** Every `canvas:hello` is answered with `editor:init` built from the store as it is then (document, version, selection, viewport, locale, context, mode), so `editor:init` is idempotent and a canvas that reloads or crashes is rebuilt without loss. The hello's `manifestHash` must equal the editor's and its protocol version must be ours; otherwise the status is `error` (`manifest` or `protocol`, with both values shown) and nothing is sent. No hello within 10 s is a `timeout` error that names the usual causes (URL, `frame-ancestors`, allowed origins). A fatal `canvas:error` is an error too. "Reload canvas" mounts a new frame with a new session.
- **Changes to the canvas.** Store changes are queued and sent once per animation frame as one `doc:patch` (`from` of the first to `to` of the last); a replacement, or more than `MAX_PATCHES` patches, is sent as `doc:set`, and so is the answer to `doc:resync-request`. Nothing is sent to a canvas that is not `initializing` or `ready`; its `editor:init` carries whatever it missed. Selection and hover go out at once, and only when they changed.
- **Viewport, zoom, locale, context, mode.** `setBreakpoint`, `setZoom` (`'fit'` scales the frame down to the room there is, or a number), `setLocale`, `setContextRef`, `setMode` update the host's state and inform the canvas. `dndOver`, `dndLeave` and `scrollTo` forward to the canvas for the drag-and-drop engine (PB-086).
- **From the canvas.** `node:click` → `store.select` (Shift adds, Ctrl/Cmd toggles); `node:hover` → `setHovered`; `inline:commit` → `node.setProp` (into `l10n[locale]` when the editing locale is not the default); `intent:move` → `node.move`; a refused command goes to `onCommandError`. `key:down`, `contextmenu`, `node:dblclick` and `dnd:target` go to callbacks for the shortcuts, menus and dnd tasks; `diagnostics` is kept in the host's state.

`BuilderEditor` does not mount the frame yet: it needs the document the persistence task (PB-087) loads.

### The insert panel (PB-078)

`<InsertPanel />` (`packages/editor/src/panels/insert`) is the palette. It reads the manifest (`<ManifestProvider>`) and lists the components that may be inserted (not `root`, not `insertable: false`) and the templates, each grouped by category and sorted by label. Search matches every word against label, type, description and keywords (templates: label, id, category). Every entry is a real button, so the palette works with the keyboard alone and without drag and drop.

- **Where it goes.** `placeInsertion(doc, registry, selectedId, what)` picks the first position `canInsert` accepts: at the end of the first slot of the selected node that takes it, else right after the selection, else after each ancestor in turn; with nothing selected, inside the root. The result is a position `node.insert` will accept, so a click is one `node.insert` command (one undo step) and the new node becomes the selection.
- **When it cannot.** Nothing is changed; the status line says "It cannot be inserted here." followed by the rule's own message (for example a slot's `max`). A read-only document says so instead.
- **Templates** are instantiated with `instantiateTemplate` (detached copies that remember their `source`). A template's `thumbnail` is shown only when it is an `http(s):` or root-relative address or a raster `data:image/` URL; anything else falls back to the initial.
- `EditorStore.registry` exposes the registry the commands run against.

### The layers panel (PB-077)

`<LayersPanel wrapperType? />` (`packages/editor/src/panels/layers`) shows the document as a WAI-ARIA tree. It reads the store and the manifest (`<ManifestProvider manifest>`; without one the rows show the component's type) and changes the document only by dispatching commands.

- **Rows.** `flattenTree(doc, expanded)` lists the visible rows (iteratively, and safe against a corrupt document that reaches a node twice); each has its ARIA level, position and set size. The label is the node's `name`, else the component's label, else its type; children in a slot other than `default` show the slot's name. The icon is a placeholder initial until the manifest's icon names have a set to map to (`data-icon` carries the name).
- **Virtualization.** Every row is 28 px, so only the rows in view (plus a few) exist; the scroll height is that of all of them. 1000 nodes flatten in well under 50 ms.
- **Keyboard.** Focus stays on the tree and `aria-activedescendant` names the active row, which is the anchor of the selection: Up/Down/Home/End move it (Shift adds to the selection), Right expands or goes to the first child, Left collapses or goes to the parent, Enter/Space select, F2 renames, Delete/Backspace remove the selection, the menu key opens the context menu. Nothing here needs a pointer.
- **Selection and hover.** Click selects (Shift adds, Ctrl/Cmd toggles), the arrow toggles a row without selecting it, pointer hover sets `hoveredId` (which the canvas shows) and a hover set elsewhere marks the row. A node selected in the canvas opens its ancestors and scrolls into view; an edit elsewhere never moves the list.
- **Rename** (F2 or double click) dispatches `node.setAttr` (`name`; empty clears it), once, whether ended by Enter, Escape or leaving the field.
- **Badges** (each with an accessible name): lock, `visibleIf`, styles for other breakpoints, and a validation or accessibility issue on the node.
- **Context menu**: rename, duplicate, wrap in container (`wrapperType`, `buildr/box` by default, only when the manifest has it), unwrap, delete. It acts on the row it opened on (selecting it first when it was not selected). A command the rules refuse shows its message in the panel's status line; a read-only document disables all of it.

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
