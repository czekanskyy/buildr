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

- Page-options dialog and guide controls; layer visibility and lock toggles.
- Custom shadow geometry, text shadows, filters and blending, transforms, motion and scroll animations, parallax, and radial gradients.
- Style-panel background image, video, repeat, attachment and overlay controls (component media props remain available); independent border-side colours and styles; descendant link and button colour controls.
- Arbitrary attributes, classes and raw CSS.
- Connection-lost canvas state requires a protocol signal. Existing selection and hover overlays remain in `packages/react` and are covered by the baseline; they are not deferred features.
- “Moje wzorce” saved-selection patterns: the insert palette only lists manifest components and templates; it has no save-selection action or personal pattern library.
- Delete-section confirmation dialog: the layers menu and Delete/Backspace dispatch `node.remove` directly.
- Ctrl/Cmd+1/2/3 device shortcuts, Ctrl/Cmd+. panel toggle and Ctrl/Cmd+Shift+O block outlines toggle are absent from the shortcut registry.
- The template's full shortcut list is not reproduced by the help dialog. Production lists undo/redo (Mod+Z, Mod+Shift+Z / Mod+Y), copy/cut/paste (Mod+C/X/V), duplicate (Mod+D), delete (Delete/Backspace), move (Alt+Up/Down), select all (Mod+A), clear selection (Escape), save (Mod+S) and help (?). `/` focuses palette search separately. Enter and arrow navigation exist in the layers tree, but template canvas Tab/Shift+Tab block traversal, Enter selection and Escape-to-parent behavior are not provided by this registry; Escape clears selection. Mod+J is only a host-override test example, not a default binding.

## PB-156 verification

Verified on 2026-11-03. Typecheck passes all 17 tasks; lint has zero errors; boundaries pass across 998 modules; all 405 editor tests pass. `pnpm e2e --concurrency=1 -- --workers=1` passes all 86 tests (43 playground, 43 example app), including English/Polish toast axe checks, Undo and dismiss actions, keyboard focus, two visible issue rows, inspector layout, and toolbar geometry at 1024/1280/1440px in both themes.

The visual baseline was refreshed cleanly in `mcr.microsoft.com/playwright:v1.63.0-noble`, with Node 22.23.2 and pnpm 12.11.2. `e2e:visual:update --workers=1 --reporter=line` and the subsequent `e2e:visual --workers=1 --reporter=line` each pass all 71 tests. The nine gallery baselines are unchanged.

- Refreshed 56 editor PNGs: `empty`, `hero-content`, `hero-style`, `hero-advanced`, `canvas-hover`, `canvas-selected`, `canvas-empty-slot`, `layers`, `insert-templates`, `publish`, `media-picker`, `issues`, `tablet`, and `mobile`, each in light/dark at 1280/1440px.
- Added `editor-toast-light-1280.png`, `editor-toast-light-1440.png`, `editor-toast-dark-1280.png`, `editor-toast-dark-1440.png`, `editor-toolbar-light-1024.png`, and `editor-toolbar-dark-1024.png`.
- Opened and checked at least ten generated PNGs against the template: toast, issues, Style inspector and publish dialog at 1280px in both themes, plus both 1024px toolbar states. Toast dismiss icons remain visible on inverted surfaces; the drawers show two complete rows; controls and dialog actions fit their regions.

PB-152 toolbar follow-up: at the final measured collapse level, the document title chip is hidden completely instead of shrinking to an unreadable sliver. Brand, panel toggles and actions remain visible; wider layouts retain the editable title and ellipsis. Geometry coverage checks both themes at 1024/1280/1440px.

Follow-up verification: typecheck (17 tasks), lint (zero errors), boundaries (998 modules), editor tests (405) and playground E2E (43) pass. Only the two 1024px toolbar PNGs were rewritten in the pinned Docker image with Node 22.23.2 / pnpm 12.11.2; both were opened and reviewed. The subsequent full visual run without updates passes all 71 tests. The initial update command rewrote no files because the difference was below the configured tolerance; the targeted forced refresh wrote each affected baseline once.
