# Phase 16 — Editor redesign v2

The approved [template](../design/template/README.md) guides the editor presentation. Phase 13 is the prerequisite. The document model, commands and canvas protocol remain unchanged.

## Tasks

| ID | Work | Dependencies | Status |
|---|---|---|---|
| PB-151 | Tokens and theme foundation | PB-131, PB-147 | Done |
| PB-152 | Shell and toolbar | PB-151 | Done |
| PB-153 | Left panel | PB-151 | Done |
| PB-154 | Inspector | PB-151 | Done |
| PB-155 | Overlays and feedback | PB-151 | Done |
| PB-156 | Documentation, tests and baseline | PB-152–PB-155 | Done |
| PB-157 | Editor redesign fidelity: every screen, state and control, plus UI-only deferred features | PB-152–PB-156 | Done |

## Template mapping

| Template area | Production module |
|---|---|
| index: shell, toolbar, device and theme controls, status | `packages/editor/src/app`, `toolbar`, `styles/shell.css` |
| index: blocks, structure, breadcrumbs | `packages/editor/src/panels/insert`, `layers`, `breadcrumbs` |
| index: canvas and states | `packages/editor/src/canvas-host` |
| index: inspector | `packages/editor/src/panels/inspector` |
| index: dialogs, issues and toasts | `packages/editor/src/dialogs`, `panels/issues`, `ui/toast.tsx` |
| style-panel: layout, position, size, spacing, typography, colour, background, border and shadow | `packages/editor/src/panels/inspector/styles` |
| style-panel: live card | Canvas runtime and document renderer in `packages/react/src` |
| components: buttons, fields, tabs, menus, popovers and rich text | `packages/editor/src/ui`, `panels/inspector/controls` |
| components: left panel | `packages/editor/src/panels/insert`, `layers` |
| components: canvas states | `packages/editor/src/canvas-host`; canvas overlays in `packages/react/src/canvas` |
| components: dialogs and toasts | `packages/editor/src/dialogs`, `ui/toast.tsx` |
| components: motion and tokens | `packages/editor/src/styles` |

## Skipped / deferred template features

These template features are not implemented in production; some need additional behavior, a model or protocol signal, or work outside the editor package:

- Guide controls; layer visibility and lock toggles. (PB-157 added a page-options dialog the template does not have.)
- Custom shadow geometry, text shadows, filters and blending, transforms, motion and scroll animations, parallax, and radial gradients.
- Style-panel background image, video, repeat, attachment and overlay controls (component media props remain available); independent border-side colours and styles; descendant link and button colour controls.
- Arbitrary attributes, classes and raw CSS.
- Connection-lost canvas state requires a protocol signal. Existing selection and hover overlays remain in `packages/react` and are covered by the baseline; they are not deferred features.
- “Moje wzorce” saved-selection patterns: the insert palette only lists manifest components and templates; it has no save-selection action or personal pattern library.
- The Ctrl/Cmd+Shift+O block outlines toggle is absent from the shortcut registry. (PB-157 added Ctrl/Cmd+1/2/3, Ctrl/Cmd+. and the delete confirmation for nodes with descendants.)
- The template's full shortcut list is not reproduced by the help dialog. Production lists undo/redo (Mod+Z, Mod+Shift+Z / Mod+Y), copy/cut/paste (Mod+C/X/V), duplicate (Mod+D), delete (Delete/Backspace), move (Alt+Up/Down), select all (Mod+A), clear selection (Escape), save (Mod+S) and help (?). `/` focuses palette search separately. Enter and arrow navigation exist in the layers tree, but template canvas Tab/Shift+Tab block traversal, Enter selection and Escape-to-parent behavior are not provided by this registry; Escape clears selection. Mod+J is only a host-override test example, not a default binding.

## PB-157 Template v2 fidelity

PB-151–PB-156 ported tokens and skins; PB-157 rebuilds the structure of every screen to match the template. UI only: no change to the document, commands, schema, canvas protocol, adapters or dependencies.

Acceptance criteria:
- The screens listed below match the template in light and dark at 1440, 1280 and 1024px, in PL and EN. The only allowed differences are the items still listed as deferred.
- Toolbar (three zones, page chip, page-options dialog, locale chip, icon Preview, more menu), left panel (Blocks / Patterns / Structure tabs, collapse and rail, target chip, Recently used, flat highlighted search results), status bar with labelled breadcrumbs, issues button and zoom menu, issues drawer inside the stage, inspector header, tabs, sections and widgets, dialogs, toasts and animations follow `docs/design/template`.
- Delete-section confirmation appears for a node with descendants; a node without descendants is removed at once with an Undo toast. Mod+1/2/3 and Mod+. work while focus is in the editor UI. Escape selects the parent and clears the selection at the top. The shortcuts dialog lists every shortcut that exists. The page-options dialog and the Patterns tab shells exist.
- No change to `packages/core`, the protocol, adapters or dependencies. Every string comes from the message catalogs. Typecheck, lint, boundaries, unit tests and both e2e suites pass; new axe states pass. The visual baseline is refreshed in the pinned Docker image and every new or changed PNG is reviewed.
- This section and the deferred list are updated; changesets are added for `@next-buildr/editor` (and `@next-buildr/react` if the canvas overlay chip changes).

Out of scope (stay deferred, need a protocol or API change): the canvas floating block toolbar, the insertion `+` point and the block outlines toggle (with Ctrl/Cmd+Shift+O); key forwarding from the canvas iframe (canvas Tab/Shift+Tab/Enter, Mod+1/2/3 and Mod+. while the canvas has focus); `DocumentAdapter.historyUrl` and the history icon; editor-controlled dark overlay colours inside the canvas; layer visibility and lock; custom and text shadows, filters, transforms, animations, background image and video, arbitrary attributes, classes and CSS; the connection-lost canvas state.

Acceptance screens: nothing selected; button selected with Style tab (Spacing, Colours open); heading Content tab with rich text; Advanced tab; Structure; Blocks with target chip and Recently used; search results; Patterns; both panels collapsed to rails; more menu; locale menu; page options; publish; shortcuts; delete confirm; Undo toast; issues drawer; tablet and mobile frames; 1024px overlay mode; empty page; canvas hover and selection chip; every section of `style-panel.html`.

### PB-157 status and known limitations

Editor redesign fidelity: Done on branch `pb-157/editor-redesign-fidelity`. Scope is fidelity to `docs/design/template` plus the UI-only deferred features; no model, command, protocol or dependency changes.

Known limitations / not done:

- Shadow cards are read-only because the grammar accepts only a theme token or `none` for `effects.shadow`.
- The overlay chip tag shows the raw component type id (the payload has no HTML tag).
- The device label keeps "Desktop · 1280px".
- The outlines toggle is omitted: there is no guides state and the `toggleGuides` callback is unused.
- The Help menu item is shown only with `helpUrl`.
- Pattern category filters are skipped (categories are free-form); the grid / list palette toggle is removed (the template has none).
- The bind button keeps the Fixed / Data / Formula segmented control; there is no field help "?" (`PropDef` has no help text).
- Per-field keyword search, number stepper arrows and the hue slider are not done.
- The multi-node delete toast reads "Block “First +2” deleted" (no plural key).
- The page-options dialog is invented (the template has none).
- The floating block toolbar, the "+" insertion point, iframe key forwarding and `DocumentAdapter.historyUrl` need protocol changes; proposed follow-up PB-158.

## PB-156 verification

Verified on 2026-11-03. Typecheck passes all 17 tasks; lint has zero errors; boundaries pass across 998 modules; all 405 editor tests pass. `pnpm e2e --concurrency=1 -- --workers=1` passes all 86 tests (43 playground, 43 example app), including English/Polish toast axe checks, Undo and dismiss actions, keyboard focus, two visible issue rows, inspector layout, and toolbar geometry at 1024/1280/1440px in both themes.

The visual baseline was refreshed cleanly in `mcr.microsoft.com/playwright:v1.63.0-noble`, with Node 22.23.2 and pnpm 12.11.2. `e2e:visual:update --workers=1 --reporter=line` and the subsequent `e2e:visual --workers=1 --reporter=line` each pass all 71 tests. The nine gallery baselines are unchanged.

- Refreshed 56 editor PNGs: `empty`, `hero-content`, `hero-style`, `hero-advanced`, `canvas-hover`, `canvas-selected`, `canvas-empty-slot`, `layers`, `insert-templates`, `publish`, `media-picker`, `issues`, `tablet`, and `mobile`, each in light/dark at 1280/1440px.
- Added `editor-toast-light-1280.png`, `editor-toast-light-1440.png`, `editor-toast-dark-1280.png`, `editor-toast-dark-1440.png`, `editor-toolbar-light-1024.png`, and `editor-toolbar-dark-1024.png`.
- Opened and checked at least ten generated PNGs against the template: toast, issues, Style inspector and publish dialog at 1280px in both themes, plus both 1024px toolbar states. Toast dismiss icons remain visible on inverted surfaces; the drawers show two complete rows; controls and dialog actions fit their regions.

PB-152 toolbar follow-up: at the final measured collapse level, the document title chip is hidden completely instead of shrinking to an unreadable sliver. Brand, panel toggles and actions remain visible; wider layouts retain the editable title and ellipsis. Geometry coverage checks both themes at 1024/1280/1440px.

Follow-up verification: typecheck (17 tasks), lint (zero errors), boundaries (998 modules), editor tests (405) and playground E2E (43) pass. Only the two 1024px toolbar PNGs were rewritten in the pinned Docker image with Node 22.23.2 / pnpm 12.11.2; both were opened and reviewed. The subsequent full visual run without updates passes all 71 tests. The initial update command rewrote no files because the difference was below the configured tolerance; the targeted forced refresh wrote each affected baseline once.
