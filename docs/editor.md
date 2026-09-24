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
- `doc:patch` carries Immer patches with JSON values only, at most 20 000 patches of at most 24 path segments, and no path segment may be `__proto__`, `constructor` or `prototype`. Its `to` must be later than `from`. `doc:set` and `editor:init` carry a document that must pass `documentSchema` (the canvas still runs the document limits on it).
- Other limits: 1000 ids in a selection or a move, 500 diagnostics, 20 000 characters of inline text, a viewport width of 240 to 4096, a prop name of letters, digits and `_` (never a prototype key).

**Synchronization**: the editor is the source of truth. Every command produces patches, batched once per animation frame. The canvas applies them with `applyPatches` to its own replica; structural sharing preserves identity for unchanged nodes, so only what actually changed re-renders. Undo/redo sends inverse patches through the same channel. Selection/hover state lives in the editor; the canvas is purely a receiver, and a click in the canvas sends an intent rather than mutating local state. A canvas reload (HMR, navigation, crash) simply re-sends `canvas:hello`; the editor replies with `editor:init` carrying current state, so state loss is impossible by construction. A component error is caught by a per-node error boundary (a placeholder plus a non-fatal `canvas:error`); `window.onerror`/`unhandledrejection` are also reported; no handshake reply shows the error screen. See [security.md](security.md) for the origin/source/nonce/CSP details.

## Drag and drop, editing features, state and commands

See dedicated pages: [drag-and-drop.md](drag-and-drop.md), [state-management.md](state-management.md), [commands.md](commands.md).
