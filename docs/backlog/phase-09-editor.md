# Phase 9: The editor application

## PB-073 - Editor scaffold - M

- **Purpose**: the editor application's shell (see `docs/editor.md`).
- **Dependencies**: PB-002
- **Files**: `packages/editor/src/{app,ui}/**`, `styles.css`
- **Implementation**: `<BuilderEditor>` (props per `docs/editor.md`), a three-column layout with resizable panels, UI primitives (Button, IconButton, Input, Select, Tabs, Popover, Dialog, Tooltip, Toggle — Radix wrappers), editor tokens (light/dark); every UI string routed through a message catalog (`en`, `pl`), never hard-coded.
- **Tests**: a render smoke test, axe against the shell.
- **Acceptance criteria**: mountable inside the playground.
- **Risks**: none.

## PB-074 - Store: document and history - L

- **Purpose**: command-driven editor state (see `docs/state-management.md`).
- **Dependencies**: PB-073, PB-039
- **Files**: `packages/editor/src/store/{create-store,document,history,selectors}.ts`
- **Implementation**: a vanilla Zustand store, the document/history slices, `dispatch(cmd)`, `transaction`, `undo`/`redo`, `docVersion`, a patch emitter (for `canvas-host`), memoized derived state (index, debounced validation).
- **Tests**: integration with commands, undo/redo, transactions, patch emission.
- **Acceptance criteria**: no mutation happens outside `execute` (verified against a frozen document in a test).
- **Risks**: none.

## PB-075 - Selection, hover, breadcrumbs - M

- **Purpose**: see `docs/editor.md`.
- **Dependencies**: PB-074
- **Files**: `packages/editor/src/store/selection.ts`, `panels/breadcrumbs/*`
- **Implementation**: `selectedIds`, `hoveredId`, clearing on deletion, restoring selection from history, Esc/Enter/Up/Down, breadcrumbs.
- **Tests**: integration (deleting a selected node, undo restoring selection).
- **Acceptance criteria**: the model is ready for multi-select.
- **Risks**: none.

## PB-076 - Canvas host - L

- **Purpose**: the iframe and its synchronization (see `docs/editor.md`).
- **Dependencies**: PB-074, PB-066, PB-067
- **Files**: `packages/editor/src/canvas-host/**`
- **Implementation**: mounting the iframe with a nonce, handshake plus `manifestHash` verification, `editor:init`, batching patches per animation frame, resync, breakpoint widths, a "fit" zoom mode, status and diagnostic error screens, reload handling, mapping canvas events onto store actions.
- **Tests**: integration against a fake canvas (MessageChannel); Playwright in the playground.
- **Acceptance criteria**: reloading the canvas never loses state.
- **Risks**: timing bugs — mitigated by an idempotent init and version numbers.

## PB-077 - The layers panel - L

- **Purpose**: the document tree UI.
- **Dependencies**: PB-075
- **Files**: `packages/editor/src/panels/layers/**`
- **Implementation**: virtualization, an ARIA tree (keyboard operable), expand/collapse, rename, icons from the manifest, badges (lock, `visibleIf`, breakpoint overrides, diagnostics), a context menu (duplicate, delete, wrap, unwrap), hover/selection sync.
- **Tests**: integration; performance at 1000 nodes (render under 50ms).
- **Acceptance criteria**: fully keyboard-operable.
- **Risks**: none.

## PB-078 - The insert panel - M

- **Purpose**: the component and template palette.
- **Dependencies**: PB-075, PB-018
- **Files**: `packages/editor/src/panels/insert/**`
- **Implementation**: categories, search (label, keywords), template thumbnails, clicking inserts after the current selection or into the selected container (the first allowed position per `canInsert`), with a message when insertion isn't possible.
- **Tests**: integration (a click produces an `insert` command with a correct target).
- **Acceptance criteria**: works without drag-and-drop (accessibility).
- **Risks**: none.

## PB-079 - Inspector: framework and basic controls - L

- **Purpose**: editing props per schema (see `docs/component-registry.md`).
- **Dependencies**: PB-075
- **Files**: `packages/editor/src/panels/inspector/{inspector,props-panel}.tsx`, `inspector/controls/{text,textarea,number,boolean,select,link,icon}.tsx`
- **Implementation**: rendering `PropDef` grouped, mapping kind to control, `setProp` with `mergeKey`, showing defaults, reset (`unsetProp`), Content/Style/Advanced tabs (anchor, name, `visibleIf`, accessibility).
- **Tests**: integration (every control dispatches the correct command).
- **Acceptance criteria**: labels and descriptions are accessible.
- **Risks**: none.

## PB-080 - Inspector: rich text, list, object controls - L

- **Purpose**: compound controls.
- **Dependencies**: PB-079
- **Files**: `packages/editor/src/panels/inspector/controls/{rich-text,list,object}.tsx`
- **Implementation**: a small Lexical instance (paragraph, h2-h4, bold/italic/link/list) serialized to the core rich text format (validated); list controls (add/remove/reorder); object controls.
- **Tests**: rich text round-tripping; list operations.
- **Acceptance criteria**: output always passes `richTextSchema`.
- **Risks**: Lexical's bundle size inside the editor (acceptable, since the editor is its own route).

## PB-081 - Value modes and the binding picker - L

- **Purpose**: binding and formula UI (see `docs/dynamic-bindings.md`).
- **Dependencies**: PB-079, PB-024, PB-087
- **Files**: `packages/editor/src/panels/inspector/values/**`
- **Implementation**: a Static/Dynamic/Formula switch, a `DataSchema` tree filtered by `accepts`, a live preview against sample data, `format`, `fallback`, a formula field with diagnostics (a list of span-tagged errors).
- **Tests**: integration (picking a field dispatches `setProp` with a binding; an invalid formula shows a diagnostic without saving).
- **Acceptance criteria**: a binding chip appears on bound controls, red when invalid.
- **Risks**: UX complexity — kept simple for MVP; CodeMirror ships in v0.2.

## PB-082 - The style inspector - L

- **Purpose**: editing styles per breakpoint (see `docs/styles.md`, `docs/responsive.md`).
- **Dependencies**: PB-079, PB-030
- **Files**: `packages/editor/src/panels/inspector/styles/**`
- **Implementation**: groups per `styles.groups`, controls (a box-model spacing editor, units, token pickers, color tokens plus custom colors), writing to the active breakpoint, a value's source plus reset, `visibility.hidden` per breakpoint.
- **Tests**: integration (a mobile-breakpoint edit dispatches `setStyle` with `bp: mobile`; reset behavior).
- **Acceptance criteria**: values outside the grammar are unrepresentable in the UI.
- **Risks**: UI density — mitigated by collapsible groups and a v0.2 property search.

## PB-083 - Toolbar - M

- **Purpose**: primary actions (see `docs/editor.md`).
- **Dependencies**: PB-076, PB-087
- **Files**: `packages/editor/src/toolbar/**`
- **Implementation**: breakpoint switcher, undo/redo (correctly disabled states), a save-status indicator (from `persistence`), preview, publish (the PB-088 dialog), links back to the CMS and to version history.
- **Tests**: integration.
- **Acceptance criteria**: accessible names and shortcuts appear in tooltips.
- **Risks**: none.

## PB-084 - Keyboard shortcuts - M

- **Purpose**: see `docs/editor.md`.
- **Dependencies**: PB-074, PB-072
- **Files**: `packages/editor/src/shortcuts/**`
- **Implementation**: a scoped shortcut registry, the MVP shortcut map, handling `key:down` forwarded from the canvas, skipping text-editing fields, platform-aware Cmd/Ctrl handling, a help dialog.
- **Tests**: integration (every shortcut triggers its action).
- **Acceptance criteria**: no shortcut fires while a text field has focus.
- **Risks**: none.

## PB-085 - Clipboard - M

- **Purpose**: copy/cut/paste/duplicate (see `docs/editor.md`).
- **Dependencies**: PB-084, PB-010, PB-017
- **Files**: `packages/editor/src/clipboard/**`
- **Implementation**: writing a fragment (`text/plain` with a marker), reading (parse -> validate -> migrate -> `reId` -> `canInsert`), an in-memory fallback, error messages.
- **Tests**: pasting malicious/corrupted JSON (rejected), pasting across documents, an older fragment version.
- **Acceptance criteria**: paste can never break document invariants.
- **Risks**: Clipboard API permission prompts — mitigated by the in-memory fallback.

## PB-086 - The editor's drag-and-drop engine - L

- **Purpose**: dragging from the palette and the tree (see `docs/drag-and-drop.md`).
- **Dependencies**: PB-076, PB-077, PB-078, PB-070
- **Files**: `packages/editor/src/dnd/**`
- **Implementation**: drag sources (palette, tree), an iframe overlay shield, forwarding `dnd:over` per animation frame (coordinate/zoom translation), a drag ghost, drop handling (insert/move); tree-internal drag-and-drop (row hit-testing plus `computeDropTarget`), autoscroll; a "Move to..." dialog.
- **Tests**: unit tests (coordinate translation); Playwright (palette-to-canvas, tree-to-tree, a forbidden drop).
- **Acceptance criteria**: 60fps during a drag on a 1000-node fixture.
- **Risks**: the largest single UX risk (R1) — a dedicated tuning time budget is allocated.

## PB-087 - Persistence: adapter, save, autosave, conflicts - L

- **Purpose**: see `docs/state-management.md`.
- **Dependencies**: PB-074
- **Files**: `packages/editor/src/persistence/**`
- **Implementation**: the `DocumentAdapter { getSession, load, save, publish, getDataSchema, getContext, listSamples?, media: { search, upload? }, previewUrl, cmsUrl? }` interface; loading (surfacing read-only state); the autosave state machine (an injected clock); Ctrl+S; dirty-state derived from the history cursor; a 409 conflict dialog (reload / overwrite); retry with backoff; `beforeunload` warnings.
- **Tests**: integration against a fake adapter with fake timers (debounce, max-wait, single-flight, 409, network errors).
- **Acceptance criteria**: no data loss across the tested scenarios.
- **Risks**: none.

## PB-088 - The Issues panel and publish flow - M

- **Purpose**: surfacing problems and publishing safely.
- **Dependencies**: PB-087, PB-042
- **Files**: `packages/editor/src/panels/issues/**`, `toolbar/publish-dialog.tsx`
- **Implementation**: a list (validation, accessibility, canvas diagnostics), a severity filter, clicking an item selects the node, `fix` actions; a publish dialog (flush, a summary, the warn/block policy, a notice that publishing affects the whole document).
- **Tests**: integration.
- **Acceptance criteria**: publishing is blocked when `publishPolicy: block` and errors exist.
- **Risks**: none.

## PB-089 - The media picker - M

- **Purpose**: see `docs/payload.md`.
- **Dependencies**: PB-079, PB-087
- **Files**: `packages/editor/src/panels/inspector/controls/media.tsx`, `dialogs/media-picker/**`
- **Implementation**: a grid, search, a type filter, upload requiring `alt`, selection producing a `MediaRef` with a `snapshot`; a control offering preview, replace, remove, and switching to Dynamic mode.
- **Tests**: integration against a fake adapter.
- **Acceptance criteria**: fully keyboard-operable.
- **Risks**: none.

## PB-090 - Sample data for templates - S

- **Purpose**: editing templates against realistic data.
- **Dependencies**: PB-076, PB-087
- **Files**: `packages/editor/src/toolbar/sample-picker.tsx`
- **Implementation**: an entry picker (`listSamples`), sending `context:set` to the canvas, remembering the selection (`localStorage`, wrapped in try/catch).
- **Tests**: integration.
- **Acceptance criteria**: switching the sample entry refreshes bindings in the canvas.
- **Risks**: none.

## PB-091 - Preview mode - S

- **Purpose**: 1:1 fidelity with production.
- **Dependencies**: PB-087, PB-083
- **Files**: `packages/editor/src/preview/**`
- **Implementation**: flush the pending save, then open a full-screen iframe or a new tab at `previewUrl`, plus an exit action.
- **Tests**: integration (the flush happens before opening).
- **Acceptance criteria**: preview reflects the latest changes.
- **Risks**: none.

## PB-092 - Playground: the full editor - M

- **Purpose**: a working editor with no Payload or Next.js dependency (proof of independence).
- **Dependencies**: PB-076, PB-087, PB-049, PB-064
- **Files**: `apps/playground/src/{editor,canvas,memory-adapter}.tsx`
- **Implementation**: a `MemoryAdapter` (`localStorage`, wrapped in try/catch, an `en`/`pl` `LocaleConfig`), a `/canvas` route (CanvasRuntime plus `MemoryDataSource` plus the default registry), a `/` route hosting the editor, sample data (posts, products) in both languages.
- **Tests**: a Playwright smoke test (insert a Hero, edit text, undo, reload).
- **Acceptance criteria**: `pnpm dev` launches the full editor.
- **Risks**: none.

## PB-115 - Editor: content language and translation - M

- **Purpose**: multilingual editing in the MVP (see `docs/i18n.md`).
- **Dependencies**: PB-079, PB-083, PB-076, PB-069, PB-088
- **Files**: `packages/editor/src/{toolbar/locale-switcher.tsx,store/locale.ts,panels/inspector/values/translation.tsx}`
- **Implementation**: a `locale` store slice (seeded from `adapter.getSession().locales`); a toolbar switcher; sending `locale:set` to the canvas; controls for `localizable` props show the default-locale value greyed out, with "Translate"/"Remove translation" actions (`setProp`/`unsetProp` with `locale`) when viewing a non-default language; inline commits use the current locale; a banner explaining that structure and style are shared across languages; a grouped "missing translations" section in the Issues panel.
- **Tests**: integration (translating a prop writes to `l10n`, switching languages updates the inspector, undoing a translation works).
- **Acceptance criteria**: editing structure in any language affects every language; editing text affects only the current one.
- **Risks**: UX clarity around what's shared vs. translated — mitigated by the banner and per-field indicators.
