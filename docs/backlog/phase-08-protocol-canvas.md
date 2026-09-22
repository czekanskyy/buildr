# Phase 8: The postMessage protocol and canvas runtime

## PB-065 - Protocol schemas - M

- **Purpose**: the editor-canvas contract (see `docs/editor.md`).
- **Dependencies**: PB-007, PB-015
- **Files**: `packages/core/src/protocol/{envelope,messages,version}.ts`
- **Implementation**: Zod schemas for the envelope and for every message type, `PROTOCOL_VERSION`, a discriminated union of message types.
- **Tests**: valid and invalid messages for every type.
- **Acceptance criteria**: the message table in `docs/editor.md` is 100% covered by schemas.
- **Risks**: none.

## PB-066 - Parent/child transports - M

- **Purpose**: secure communication (see `docs/security.md`).
- **Dependencies**: PB-065
- **Files**: `packages/core/src/protocol/{parent-transport,child-transport,window-like}.ts`
- **Implementation**: `createParentTransport({ iframe, canvasOrigin, session })`, `createChildTransport({ allowedOrigins })`; `send`, `request` (with a timeout), `on`; origin/source/session/schema validation; `targetOrigin` is never `'*'`.
- **Tests**: MessageChannel/jsdom tests: rejecting a bad origin, source, session, schema; timeout behavior.
- **Acceptance criteria**: 100% coverage of the security-relevant branches.
- **Risks**: none.

## PB-067 - Canvas runtime: sync and render - L

- **Purpose**: the canvas mirrors the editor's document (see `docs/editor.md`).
- **Dependencies**: PB-066, PB-047, PB-031
- **Files**: `packages/react/src/canvas/{runtime,store,node-view,boundary}.tsx`
- **Implementation**: handshake, `editor:init`, a replica plus `applyDocumentPatches`, version-gap detection triggering `doc:resync-request`, a small per-node-subscribable store, `NodeView` (memoized, per-node boundary, `data-bid`), placeholders, diagnostic reporting, `window.onerror`.
- **Tests**: jsdom: init, a series of patches, a version gap, a component error (a placeholder rather than a crash); a re-render counter (editing one prop re-renders exactly one node).
- **Acceptance criteria**: works in both the playground (PB-092) and the Next.js app (PB-105).
- **Risks**: replica drift — mitigated by version numbers plus resync.

## PB-068 - Canvas: selection, hover, overlay - L

- **Purpose**: visual editing (see `docs/editor.md`).
- **Dependencies**: PB-067
- **Files**: `packages/react/src/canvas/{interactions,overlay/*}.tsx`
- **Implementation**: click/hover capture (blocking navigation and form submission), an overlay in a Shadow DOM (outline, label, handle, an outline per Loop instance), `requestAnimationFrame` updates on scroll/resize, a `ResizeObserver` on just two elements, auto-opening ancestor `<details>` elements, a dev-mode warning when `data-bid` is missing.
- **Tests**: jsdom (logic), Playwright in the playground (overlay positioning).
- **Acceptance criteria**: the overlay never affects the site's own layout or styles.
- **Risks**: `position: fixed/sticky` elements on the page, handled via viewport-relative `getBoundingClientRect` reads.

## PB-069 - Canvas: inline text editing - M

- **Purpose**: editing text directly on the canvas.
- **Dependencies**: PB-068
- **Files**: `packages/react/src/canvas/inline-edit.ts`
- **Implementation**: a double-click enables `contenteditable="plaintext-only"` on the `inlineProp` element (static values only); Enter/blur sends `inline:commit`; Escape cancels; incoming patches for the prop being edited are ignored mid-edit.
- **Tests**: jsdom plus Playwright (typing text produces exactly one history entry).
- **Acceptance criteria**: the caret position never resets while typing.
- **Risks**: `plaintext-only` support differences across browsers (fallback: `contenteditable="true"` plus pasting as plain text).

## PB-070 - Canvas: drag-and-drop hit-testing and indicators - L

- **Purpose**: dropping inside the canvas (see `docs/drag-and-drop.md`).
- **Dependencies**: PB-068, PB-043
- **Files**: `packages/react/src/canvas/dnd/*`
- **Implementation**: `buildHitPath(point)` (`elementsFromPoint`, following `data-bid`, reading computed display/direction), handling `dnd:over`/`dnd:leave` via `computeDropTarget` to draw the overlay indicator and reply `dnd:target`; handle-driven dragging (pointer capture, autoscroll) sending `intent:move`.
- **Tests**: jsdom (hit-path construction against mocked rects), Playwright (dragging a node end to end).
- **Acceptance criteria**: a forbidden drop shows its reason.
- **Risks**: UX complexity — thresholds tuned iteratively.

## PB-071 - Canvas: data - M

- **Purpose**: context, queries and media inside the canvas.
- **Dependencies**: PB-067, PB-026
- **Files**: `packages/react/src/canvas/data.ts`
- **Implementation**: the runtime accepts any `DataSource`; `context:set` and `locale:set` fetch context (in the given locale) and switch `ctx.locale`; `prepareRender` reruns after spec changes (debounced 300ms, cached by spec hash); loading states; errors surfaced as diagnostics.
- **Tests**: a fake async `DataSource`: debounce, caching, error handling.
- **Acceptance criteria**: editing text never triggers a re-query.
- **Risks**: none.

## PB-072 - Canvas: shortcut and context-menu forwarding - S

- **Purpose**: keyboard input works while focus is inside the iframe.
- **Dependencies**: PB-067
- **Files**: `packages/react/src/canvas/forwarding.ts`
- **Implementation**: `key:down` (outside text fields and inline-edit mode), `contextmenu` with a point, `preventDefault` for captured shortcuts.
- **Tests**: jsdom.
- **Acceptance criteria**: Ctrl+Z inside the canvas undoes a change.
- **Risks**: browser shortcut conflicts — the shortcut list avoids any critical collisions.
