# Phase 13: Editor visual polish

The MVP editor works but is visually unfinished (risk R10). This phase gives it a new visual identity (see the decisions below) and turns it into a coherent, dense, professional tool **without changing behaviour**: no new commands, no protocol changes, no document-shape changes. Every task is a pure presentation change plus the tests and screenshots that prove it.

## Audit (2026-09-25, playground at 1280 and 1440px, dark theme)

Findings the tasks below are built from. Each finding names the task that fixes it.

| # | Finding | Where | Task | Status |
|---|---|---|---|---|
| A1 | Components in the insert panel and the layers tree are shown as the **first letter of their label** in a grey square (`A`, `C`, `B`, `B`...), although every definition already declares a lucide icon name in `meta.icon`. | `panels/insert/insert-panel.tsx:149`, `panels/layers/layers-panel.tsx` | PB-120 | Resolved |
| A2 | Several components share the same icon (`layout-grid`: Card, Grid, Section; `file-text`: Text, Textarea, RichText; `send`: Button, Form; `list`: List, Stack; `minus`: Divider, ListItem), and some are misleading (`maximize` for Container). | `packages/components/src/*/definition.ts` | PB-121 | Resolved |
| A3 | Unicode glyphs stand in for icons: `↶ ↷` (undo/redo), `←` (back), `▾ ▸` (tree toggles, select triggers), `🔒 ◐ ▭ ⚠` (layer badges). They render differently per OS/font and the emoji ignores the theme colour. | `toolbar/toolbar.tsx`, `layers-panel.tsx`, `ui/primitives.tsx` | PB-120 | Resolved |
| A4 | Panels have **zero padding**: the search field, the category headings and the palette tiles touch the panel edges; the inspector's content starts at the border. | `.bd-panel`, `.bd-insert`, `.bd-inspector` | PB-122, PB-125, PB-127 | Resolved |
| A5 | Spacing and type are ad hoc: only 4 spacing tokens exist, most rules use literal `4px/6px/8px/12px`; five different small font sizes (11/12/13/14/15px) are chosen per rule; headings in the insert panel mix 13px bold with 11px uppercase. | `styles.css` | PB-119 | Resolved |
| A6 | Tokens are referenced that are never defined and silently fall back: `--bd-accent-soft`, `--bd-surface-hover`, `--bd-surface-1`, `--bd-warning`. Several rules also carry hard-coded fallback colours that differ from the palette. | `styles.css` | PB-119 | Resolved |
| A7 | No `color-scheme` is declared, so in dark mode native scrollbars, the search field's clear button and form controls render **light** (a white scrollbar track next to a dark panel). | `.buildr-editor` | PB-119 | Resolved |
| A8 | The canvas iframe is scaled with `transform: scale()` but keeps `height: 100%`, so at any zoom below 100% the page ends part-way down the canvas and the rest is an empty grey area. | `canvas-host/canvas-frame.tsx:132` | PB-124 | Resolved |
| A9 | The stage has no margin, shadow or width indicator; the page is glued to the top edge. The host already supports `setZoom('fit' \| number)`, but there is no UI for it. | `canvas-frame.tsx`, `toolbar/` | PB-123, PB-124 | Resolved |
| A10 | Splitters are 6px solid bars in the border colour — visually heavier than the panels they separate. | `.bd-splitter` | PB-122 | Resolved |
| A11 | The issues region permanently takes a 37px row at the bottom holding a single "Show issues" button, with no counts. | `app/layout.tsx` | PB-122, PB-129 | Resolved |
| A12 | Toolbar: breakpoints are large text buttons (the active one a saturated primary block), undo/redo are tiny glyphs, controls do not collapse at narrow widths (the title is cut to "Pla..." first). | `toolbar/toolbar.tsx` | PB-123 | Resolved |
| A13 | The selected layer row uses the full accent as background — the strongest colour on screen is spent on the tree, and it clashes with the primary buttons. | `.bd-layer[data-selected]` | PB-126 | Resolved |
| A14 | Four independent notice implementations (clipboard, app, insert, inspector), each styled differently, two of them `position: fixed` at the same spot. | `styles.css`, several panels | PB-129 | Resolved |
| A15 | The playground's `<body>` keeps the default 8px margin, so the whole editor scrolls by 16px in both directions. | `apps/playground` | PB-122 | Resolved |
| A16 | The style inspector and the value editor use plain buttons for mode switches and a flat list of inputs; there is no box-model widget, no token swatches, no indication of which breakpoint a value comes from beyond small text. | `panels/inspector/{styles,values}` | PB-128 | Resolved |

## Decisions (Q&A with the maintainer, 2026-09-25)

| # | Question | Decision |
|---|---|---|
| V1 | Visual direction | **A new visual identity** for Buildr, not just a clean-up of the current look. It is designed in PB-147 before PB-119 freezes the tokens. |
| V2 | Palette | **Inspired by the WordPress block editor's "Modern" scheme**: a blueberry-like accent (around `#3858e9`), neutral greys in the spirit of the block editor (`#1e1e1e`, `#757575`, `#ddd`, `#f0f0f0`), a dark toolbar. Inspiration only: our own token values, no WordPress names, logos or trademarks anywhere in the UI. |
| V3 | Typography | **Inter, self-hosted**: woff2 files shipped inside `@buildr/editor` (OFL licence file included), no external CDN, so the CSP stays unchanged. Tabular numerals in the inspector. |
| V4 | Character | **Dense and precise**: 28px controls, 4–6px radii, thin borders, shadows only on floating layers (menus, popovers, dialogs, toasts). |
| V5 | Theme | **Follows the system by default, with a light / dark / system switch** in the UI, remembered per user (`localStorage`, try/catch). A host that sets `data-theme` explicitly wins, and the switch is then hidden. |
| V6 | Component icons | **A curated static lucide map** (~60 names) with a neutral `box` fallback. No `DynamicIcon`, no host-registered icons for now. |
| V7 | Stylesheet | **Split into partials plus stylelint**: `styles/*.css`, concatenated into the published `styles.css` (the public path stays the same). Literal colours, spacing and font sizes are forbidden outside `tokens.css`. |
| V8 | Insert palette | **3-column compact tiles** (2 columns when the panel is narrow), with a list-view toggle remembered per user. |
| V9 | Narrow screens | **Below 1100px the side panels become toggleable overlays**; the canvas always keeps at least 480px. |
| V10 | Schedule | Runs **in parallel with phase 14** and ships in **v0.2**. |

## Principles

- **Behaviour is frozen**, with two deliberate exceptions: the theme switch (V5) and the narrow-screen panel overlays (V9). A task that finds it needs a new command, a protocol message or a new prop stops and files a separate card.
- **Every visual change is reviewed as a screenshot diff** against the PB-118 baseline (`visual` label).
- **Tokens only.** After PB-119 no rule may contain a literal colour, spacing or font size; stylelint enforces it.
- **No new hard-coded strings** — icons get accessible names from the messages catalog, decorative icons are `aria-hidden`.
- **Density target**: a 1280px-wide screen shows the full toolbar on one row, and the inspector fits a typical component's Content tab without scrolling.

## Order

```
PB-118 -> PB-147 -> PB-119 -> PB-120 -> { PB-122, PB-123, PB-124, PB-125, PB-126, PB-127, PB-129, PB-130 } -> PB-128 -> PB-131
                               PB-121 (parallel to PB-120, components package)
```

PB-147 was added after the ID range PB-118 – PB-131 had been assigned; IDs are identifiers, not queue positions (see the backlog README).

---

## PB-118 - Editor visual baseline - M

- **Purpose**: capture the editor as it is today, so every later task is reviewed as a diff (PB-113 only covers the component gallery).
- **Dependencies**: PB-113
- **Files**: `apps/playground/e2e/visual/editor/**`, `apps/playground/playwright.visual.config.ts`
- **Implementation**: deterministic editor states seeded through the `MemoryAdapter`: empty document, a landing page with a Hero selected (Content, Style and Advanced tabs), the layers tab expanded, the insert tab scrolled to templates, the publish dialog, the media picker, the issues panel open, the canvas at tablet and mobile width. Each in light and dark (`data-theme`), at 1280x800 and 1440x900. Animations disabled, fonts pinned to the Docker image.
- **Tests**: (this task *is* the test suite)
- **Acceptance criteria**: the baseline is approved and checked in; a change to `styles.css` produces a reviewable diff in CI.
- **Risks**: the canvas iframe loads asynchronously — mitigated by waiting on `canvas:ready`, as PB-112 does.

## PB-147 - Visual identity and key-screen mockups - M

- **Purpose**: decide what the new Buildr editor looks like (V1–V5) before any token is frozen.
- **Dependencies**: PB-118
- **Files**: `docs/design/identity.md` (new), `docs/design/mockups/*.png|svg` (new), `docs/editor-design.md` (first draft)
- **Implementation**:
  - Palette: accent scale 50–900 derived from a blueberry-like hue (V2), a neutral scale for the dark toolbar and the light/dark surfaces, and semantic colours (danger, warning, success, info) tuned so none of them can be confused with the accent. Contrast is checked for every text/surface pair in both themes (4.5:1 for text, 3:1 for UI boundaries).
  - Type: Inter (V3) at 11/12/13/15px, with weights and line heights per size and tabular numerals for numeric inputs.
  - Shape and density: control heights, radii, border weights, elevation levels (V4), and focus-ring style.
  - Mockups of the key screens in light and dark: the full editor with a Hero selected, insert palette (tiles and list), layers, inspector Content and Style tabs, a dialog, the status bar, the narrow-screen overlay mode.
  - A short "not WordPress" check: no WordPress names, logos or trademarked marks, and the accent value is our own.
  - Review with the maintainer; the approved values become the input to PB-119.
- **Tests**: none (design); the contrast table is re-verified by PB-119's unit test.
- **Acceptance criteria**: the maintainer approves the mockups and the token table in the PR.
- **Risks**: bikeshedding — timeboxed to the M size, at most one revision round.

## PB-119 - Design tokens, base styles and UI guidelines - M

- **Purpose**: one scale for spacing, type, radii, sizes and elevation, built from the PB-147 identity; fixes A5, A6, A7.
- **Dependencies**: PB-118, PB-147
- **Files**: `packages/editor/src/styles.css` (split into `packages/editor/src/styles/{tokens,base,shell,primitives,panels}.css`, concatenated into the published `styles.css` by `tooling/scripts/copy-css.mjs`), `.stylelintrc`, `docs/editor-design.md` (new)
- **Implementation**:
  - Tokens: spacing `--bd-space-0..8` (2/4/6/8/12/16/20/24/32px); type `--bd-text-xs/sm/md/lg` (11/12/13/15px) with matching line heights and `--bd-weight-regular/medium/semibold`; radii `--bd-radius-sm/md/lg` (4/6/8px); control heights `--bd-control-sm/md/lg` (24/28/32px); `--bd-elevation-1/2/3`; `--bd-duration-fast/base` with a `prefers-reduced-motion` override.
  - Colour: define the missing roles (`--bd-accent-soft`, `--bd-accent-hover`, `--bd-surface-hover`, `--bd-surface-selected`, `--bd-warning`, `--bd-success`, `--bd-border-strong`, `--bd-text-subtle`) for both themes; remove every hard-coded fallback colour; contrast of every text/background pair >= 4.5:1 (3:1 for large text and UI boundaries), documented in a table.
  - `color-scheme: light dark` on `.buildr-editor` (respecting `data-theme`), themed thin scrollbars (`scrollbar-color`, `scrollbar-width: thin`).
  - The PB-147 palette and density values (V2, V4) as tokens for both themes; the dark toolbar has its own surface tokens.
  - Inter (V3): woff2 subsets (latin + latin-ext for Polish) in `packages/editor/src/fonts/`, `@font-face` with `font-display: swap` in `base.css`, copied into `dist` by the build, `LICENSE-inter.txt` alongside; `--bd-font` falls back to the system stack.
  - Replace every literal size/colour in the existing rules with tokens. This task **changes the look on purpose** (new identity): the visual diff is expected and is reviewed against the PB-147 mockups.
  - A stylelint rule (`declaration-strict-value`) forbidding literal colours, spacing and font sizes outside `tokens.css`.
  - `docs/editor-design.md`: the token tables, the layout grid, icon rules (PB-120), density rules, do/don't examples. Future editor tasks reference it.
- **Tests**: a unit test parsing `tokens.css` and checking the contrast table; a build test that the fonts and the licence end up in `dist`; the visual suite (diff reviewed against the mockups).
- **Acceptance criteria**: no `var(--x, fallback)` for an undefined token remains; dark mode shows dark scrollbars; stylelint passes in CI; no request leaves the site's origin for fonts.
- **Risks**: splitting the stylesheet changes the build — mitigated by a test asserting the published `styles.css` contains every partial in order. Font weight in the bundle — mitigated by subsetting and loading only 400/500/600.

## PB-120 - Editor icon system - M

- **Purpose**: real, theme-aware icons everywhere; fixes A1 and A3.
- **Dependencies**: PB-119
- **Files**: `packages/editor/src/ui/icon.tsx` (new), `ui/primitives.tsx`, `ui/index.ts`, `toolbar/toolbar.tsx`, `panels/layers/layers-panel.tsx`, `panels/insert/insert-panel.tsx`, `package.json`
- **Implementation**:
  - `lucide-react` as a dependency (already allowed by `package-boundaries.md`; justification in the PR: tree-shakeable, ISC, the same set the components package uses for `meta.icon`).
  - `<Icon name size="sm|md" label?>`: a **curated static map** of the lucide icons the editor uses itself (no `DynamicIcon`, no dynamic import of the whole set — bundle impact is measured and stated in the PR); decorative by default (`aria-hidden`), with `label` it becomes `role="img"`.
  - `<ComponentIcon meta>`: resolves `meta.icon` against a second curated map covering the common component vocabulary (layout, text, media, form, data — ~60 names); an unknown or missing name falls back to a neutral `box` icon, never to a letter. Custom components with an unknown name therefore still look consistent.
  - `IconButton` takes an icon name instead of a string glyph; `Select` gets a chevron icon.
  - Replace every glyph listed in A3; layer badges become icons with a tooltip carrying the existing message.
- **Tests**: integration (the insert tile and layer row render an `svg` for a known icon and the fallback for an unknown one; icon buttons keep their accessible names); axe; the visual suite.
- **Acceptance criteria**: `grep` finds no unicode arrow/triangle/emoji glyph used as an icon in `packages/editor/src`; the editor bundle grows by less than 15 kB gzip.
- **Risks**: a site author's component uses a lucide name outside the curated map — mitigated by the fallback and by documenting the supported list (and how to request additions) in `docs/component-registry.md`.

## PB-121 - Distinct icons for the built-in components - S

- **Purpose**: every built-in component is recognisable at a glance; fixes A2.
- **Dependencies**: PB-064
- **Files**: `packages/components/src/*/definition.ts`, `docs/components.md`, `docs/ai/component-development.md`, `apps/playground/src/*.test.ts`
- **Implementation**: one distinct lucide icon per component, for example: Page `file`, Section `rectangle-horizontal`, Container `square-dashed`, Stack `rows-3`, Grid `layout-grid`, Card `panel-top`, Heading `heading`, Text `type`, RichText `pilcrow`, Link `link`, Button `mouse-pointer-click`, Image `image`, Icon `sparkles`, Badge `tag`, Divider `separator-horizontal`, List `list`, ListItem `dot`, Accordion `chevrons-up-down`, AccordionItem `chevron-down`, Loop `repeat`, Pagination `ellipsis`, Form `clipboard-list`, Input `text-cursor-input`, Textarea `align-left`, Checkbox `square-check`, Select `square-chevron-down` (final choice made in a quick design review, recorded in `docs/components.md`). `meta.icon` is presentation metadata: the manifest hash changes, the document shape does not, **no migration**. The component Definition of Done gains "icon is unique within the built-in catalogue".
- **Tests**: a playground test (the only place that sees both packages) asserting every built-in `meta.icon` is unique and is present in the editor's `ComponentIcon` map.
- **Acceptance criteria**: no two built-in components share an icon.
- **Risks**: none (a changeset for `@buildr/components` is required — the manifest changes).

## PB-122 - Shell layout, panels and splitters - M

- **Purpose**: a calm, consistent frame; fixes A4 (shell part), A10, A11 (layout part), A15.
- **Dependencies**: PB-120
- **Files**: `packages/editor/src/app/{layout.tsx,use-resizable.ts}`, `styles/shell.css`, `apps/playground/src/main.tsx` (+ its global CSS)
- **Implementation**:
  - A panel anatomy used by all three panels: a 40px panel header (tabs or title), a scroll body with `--bd-space-4` side padding, an optional sticky footer.
  - Splitters become a 1px line with an 8px invisible hit area and an accent line on hover/drag; double-click resets the width; widths are remembered (`localStorage`, try/catch).
  - The issues row becomes a 28px **status bar**: error/warning counts with icons (from the existing issues store), the active breakpoint and zoom, the save state; clicking the counts toggles the issues drawer (content is restyled in PB-129).
  - Below 1100px the left and right panels become toggleable overlays (buttons in the toolbar); the canvas keeps at least 480px.
  - Playground: reset `body { margin: 0 }`, root at `100dvh`.
- **Tests**: integration (splitter keyboard resizing still works, reset on double-click, the status bar shows the issue counts and toggles the drawer); axe; the visual suite.
- **Acceptance criteria**: no page-level scrollbars at any width >= 800px; all regions keep their landmark names.
- **Risks**: none.

## PB-123 - Toolbar redesign - M

- **Purpose**: a compact, grouped toolbar that fits 1280px on one row; fixes A12 and the zoom half of A9.
- **Dependencies**: PB-120
- **Files**: `packages/editor/src/toolbar/**`
- **Implementation**: three zones — left (back to CMS as an icon button, document title with status pill draft/published), centre (a segmented breakpoint control with `monitor`/`tablet`/`smartphone` icons and the width in the tooltip, a zoom menu: Fit, 50, 75, 100, 125% via the existing `host.setZoom`), right (undo/redo icon buttons, save status as icon + short text, locale and sample pickers as compact selects, Preview as a secondary button, Publish as the only primary button). The toolbar uses the dark toolbar surface from PB-147. The theme switch (V5: light / dark / system, remembered per user, hidden when the host forces `data-theme`) lives in the `more` menu. Secondary items (versions, CMS link, shortcuts help) also move into that menu when space runs out (a `ResizeObserver`, not a media query, because the editor may be embedded).
- **Tests**: integration (every existing action is still reachable at 1024px, zoom dispatches `setZoom`, disabled states unchanged, tooltips show shortcuts); axe; the visual suite.
- **Acceptance criteria**: at 1280px everything fits on one row without truncating a title shorter than 32 characters.
- **Risks**: none.

## PB-124 - Canvas stage - M

- **Purpose**: the page looks like a page; fixes A8 and the stage half of A9.
- **Dependencies**: PB-122
- **Files**: `packages/editor/src/canvas-host/canvas-frame.tsx`, `styles/shell.css`
- **Implementation**: the iframe height compensates for the scale (`height: stageHeight / scale`) so the page always fills the visible canvas; the stage is centred with `--bd-space-6` padding, a subtle page shadow and a small width label above it ("Tablet · 768px"); scale changes animate (respecting reduced motion); the connecting/error screens get an icon, a title and the existing detail list in a card.
- **Tests**: unit (height/scale arithmetic for fit and fixed zoom); integration against the fake canvas; the visual suite at all three breakpoints.
- **Acceptance criteria**: at 50% zoom the canvas shows twice the page height instead of an empty area; pointer coordinates forwarded to the canvas (PB-086) are unaffected (the existing coordinate tests pass).
- **Risks**: drag-and-drop coordinate translation depends on the frame's rect — mitigated by running the PB-086 Playwright tests as part of this task.

## PB-125 - Insert panel - M

- **Purpose**: a fast, scannable palette; fixes A1 (layout part) and A4 in the insert panel.
- **Dependencies**: PB-120, PB-121
- **Files**: `packages/editor/src/panels/insert/**`
- **Implementation**: a sticky search field with a search icon and a clear button (`/` focuses it); compact tiles (icon above a one-line label, 3 per row at the default width, 2 when narrow) with a list-view toggle (icon + label + description) remembered per user; collapsible categories with item counts; templates in their own section with thumbnails at a fixed 16:10 ratio and a skeleton while loading; the description in a tooltip; `grab` cursor on hover; a friendly empty state for a search without results; the notice moves to the shared toast (PB-129).
- **Tests**: integration (search, collapse, view toggle persistence, click-to-insert unchanged); axe; the visual suite.
- **Acceptance criteria**: every built-in component is visible without scrolling in the list of its category at 1440x900; keyboard-only insertion still works.
- **Risks**: none.

## PB-126 - Layers panel - M

- **Purpose**: a tree that reads like a professional layers panel; fixes A13 and the layers part of A1/A3.
- **Dependencies**: PB-120, PB-121
- **Files**: `packages/editor/src/panels/layers/**`
- **Implementation**: 28px rows, indent guides, chevron icons for expand/collapse, `ComponentIcon`, the node name (or label) with the slot name as a muted suffix; selection uses `--bd-surface-selected` with an accent left bar, hover uses `--bd-surface-hover`; badges become small icons with tooltips; hover actions on the right (a `more` button opening the existing context menu); the rename input fits the row; drop indicators (PB-086) restyled with tokens.
- **Tests**: the existing integration tests; performance at 1000 nodes stays under 50ms; axe; the visual suite.
- **Acceptance criteria**: the ARIA tree and keyboard behaviour are unchanged; the performance budget holds.
- **Risks**: row height changes affect virtualization — mitigated by keeping the row height a single constant shared by CSS and the virtualizer.

## PB-127 - Inspector layout - M

- **Purpose**: a structured, dense inspector; fixes A4 in the inspector.
- **Dependencies**: PB-120
- **Files**: `packages/editor/src/panels/inspector/{inspector,props-panel}.tsx`, `inspector/controls/*.tsx` (layout only), `styles/panels.css`
- **Implementation**: a header with the component icon, the label and the editable node name, plus reset/duplicate/delete icon buttons; full-width tabs; prop groups as collapsible sections (open state remembered per component type); a field layout rule — short controls (boolean, select, number, icon) as a two-column row (label left), long ones (text, rich text, lists, media) stacked; reset as an icon button that appears on hover/focus when a value is set; hints under the control in `--bd-text-subtle`; binding chips as pills; empty states for "nothing selected" (icon + hint about clicking the canvas or pressing Enter) and "no properties".
- **Tests**: the existing integration tests (every control still dispatches the correct command); axe (labels still associated); the visual suite.
- **Acceptance criteria**: a Heading's and a Button's Content tab fit into 800px of height without scrolling.
- **Risks**: none.

## PB-128 - Style inspector and value editor controls - L

- **Purpose**: visual controls for styles and bindings; fixes A16.
- **Dependencies**: PB-127
- **Files**: `packages/editor/src/panels/inspector/styles/**`, `inspector/values/**`, `ui/primitives.tsx` (new `SegmentedControl`, `NumberUnitInput`, `ColorSwatch`)
- **Implementation**: a box-model widget for margin/padding (click a side to edit it, alt-click edits both sides of an axis); `NumberUnitInput` with arrow-key steps (shift for x10) and a unit menu limited to what the grammar allows; token pickers showing swatches (colours) and values (spacing); segmented icon controls for direction, alignment, justify and text-align; per-property source indicator — a dot coloured by origin (set on this breakpoint / inherited from a larger one / default) with a tooltip and reset; the Static/Dynamic/Formula switch as a segmented control with icons; the data tree with type icons and the live preview as a card.
- **Tests**: integration (every widget writes the same `setStyle`/`setProp` commands as the controls it replaces, including `mergeKey` coalescing while stepping a number); axe; the visual suite.
- **Acceptance criteria**: values outside the grammar remain unrepresentable (PB-082's criterion still holds).
- **Risks**: widget complexity — the size is L; if it grows, split the value editor into its own card.

## PB-129 - Feedback surfaces: toasts, dialogs, issues drawer - M

- **Purpose**: one consistent way to tell the user something; fixes A14 and the content half of A11.
- **Dependencies**: PB-122
- **Files**: `packages/editor/src/ui/{toast,primitives}.tsx`, `panels/issues/**`, `toolbar/publish-dialog.tsx`, `clipboard/react.tsx`, `app/editor-app.tsx` (notice wiring only)
- **Implementation**: a single toast region (`role="status"`, polite; errors `role="alert"`) with success/info/warning/error variants, icons and auto-dismiss (paused on hover/focus); the four existing notices call it; dialogs get a header with a close icon button, a scrollable body and a right-aligned footer; the issues drawer lists items with severity icons, the component icon and name, and groups by severity; the publish dialog shows counts as icon badges.
- **Tests**: integration (each former notice now appears in the toast region with the same text; screen-reader announcement roles); axe; the visual suite.
- **Acceptance criteria**: no component other than the toast region uses `position: fixed` for messages.
- **Risks**: none.

## PB-130 - Canvas overlay polish - M

- **Purpose**: hover, selection and drop feedback inside the canvas match the editor.
- **Dependencies**: PB-119
- **Files**: `packages/react/src/canvas/overlay/**`, `packages/react/src/canvas/*.css`
- **Implementation**: audit the overlay first (the screenshots are attached to the PR); then: 1px hover outline and 2px selection outline in the editor accent, a label chip with the component label (and node name) that flips inside the node when it would leave the viewport, clear drop-position bars and "inside" highlights, restyled empty-slot placeholders (`editor.emptySlotText`) with a dashed outline. The overlay palette is a fixed set of CSS variables inside the canvas (**no protocol change**; theming it from the editor is a separate, later card).
- **Tests**: the existing jsdom tests; the visual suite (canvas states: hover, selected, dragging over, empty slot).
- **Acceptance criteria**: the overlay never shifts page layout (it stays in its own layer) and never intercepts clicks outside interactions it owns.
- **Risks**: the overlay sits on top of arbitrary site CSS — mitigated by keeping it in a shadow root or a namespaced, reset layer as it is today.

## PB-131 - Visual QA, accessibility pass and documentation - S

- **Purpose**: close the phase.
- **Dependencies**: PB-122 – PB-130
- **Files**: `apps/playground/e2e/visual/editor/**` (baseline refresh), `docs/{editor,editor-design}.md`, `README.md` (screenshot)
- **Implementation**: axe against every baseline state in both themes; a keyboard-only walkthrough of the MVP editor flows (recorded in the PR); refresh the baseline; screenshots in `docs/editor.md` and the README.
- **Tests**: (this task *is* the check)
- **Acceptance criteria**: zero axe violations in the editor in both themes; all findings A1-A16 are marked resolved in this file.
- **Risks**: none.
- **Status**: Done. Axe (`apps/playground/e2e/editor-a11y.spec.ts`) passes on all 20 states (10 per theme). Findings A1-A16 are resolved (table above). Fixed in this task: inactive breakpoint icons unreadable on the dark toolbar in the light theme; dialogs dropped focus to `<body>` on close (the `Dialog` primitive now returns it); the insert panel's local `role="status"` line is now `useToast()`.
- **Known follow-ups** (none blocks the phase):
  - The canvas overlay has no dark-theme palette (PB-130): the outline, chip and placeholder colours are the light ones on the dark canvas surround.
  - The "dragging over" overlay state is not in the visual baseline (a pointer drag across the iframe is not deterministic); it is covered by jsdom and dnd tests only.
  - The media picker baseline shows an empty list ("No files found."); seed a few `MemoryAdapter` media items so the grid is captured.
  - The issues panel has no initial validation: it stays empty until an edit or a publish attempt runs the check.
  - The lucide icons added +9.5 kB gzip to the editor bundle; a per-icon import map or a smaller curated set would recover part of it.
  - The Textarea component uses the `text-align-start` icon, which reads like an alignment control rather than a text area; pick a distinct one.
  - The inspector, style inspector and layers panel still keep local `role="status"` notice lines; they clear on the next successful edit, which needs an explicit "clear" in `useToast` (or a decision to let them time out) before they can move to the toast region.
