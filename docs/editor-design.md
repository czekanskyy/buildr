# Editor design guidelines

Status: **reference (PB-151, template v2).** Token values are shipped in `packages/editor/src/styles/tokens.css`; the icon rules (PB-120) are in [Icons](#icons). The source of the approved values is [template tokens v2](design/template/README.md); mockups are in [design/mockups/](design/mockups/).

Every editor task in [phase 13](backlog/phase-13-editor-visual-polish.md) references this document. Where it disagrees with a mockup, the approved template tokens v2 win.

## Principles

1. **Dense and precise.** 32px controls, 4-6px radii, thin borders, 12-13px text. The editor is a tool used for hours; it should show as much of the document and its properties as fit, calmly.
2. **Content first, chrome second.** The canvas is the loudest thing on screen. Panels are flat and quiet; the accent colour is reserved for selection, focus and the one primary action.
3. **One accent, one primary.** At most one solid primary button is visible per region (Publish in the toolbar, the confirm button in a dialog). Everything else is secondary or ghost.
4. **Tokens only.** No literal colour, spacing or font size outside `tokens.css` (enforced by stylelint from PB-119). If a value is missing, add a token instead of a literal.
5. **Flat panels, floating layers.** Shadows are for menus, popovers, tooltips, toasts, dialogs, narrow-screen overlays and the page on the stage. Never for panels or cards inside panels.
6. **Both themes, always.** Every change is checked in light and dark. Text pairs meet 4.5:1, UI boundaries 3:1 (table in `identity.md`).
7. **Behaviour is frozen.** Presentation work does not add commands, protocol messages or props (see the phase 13 principles).
8. **Accessible by construction.** Visible focus ring, no information by colour alone (icons or text next to colour), decorative icons `aria-hidden`, no hard-coded user-visible strings.

## Palette, type and shape (summary)

| Topic | Summary | Details |
|---|---|---|
| Accent | indigo-blue `#3f5ae0` (scale 50-900) | [identity.md section 3](design/identity.md#3-colour) |
| Neutrals | cool greys; surfaces `bg` / `surface` / `surface-2`, states `surface-hover` / `surface-selected` | section 3 |
| Toolbar | white in light, near-black in dark, own `toolbar*` tokens | section 3.4 |
| Semantic | danger, warning, success, info (teal), each with a `*-soft` background | section 3.4 |
| Type | Inter 400/500/600 at 11 / 12 / 13 / 15 / 18px, line heights 16 / 16 / 20 / 24 | [section 4](design/identity.md#4-typography) |
| Spacing | 2px half-step; 4 / 8 / 12 / 16 / 24 / 32px (`--bd-space-1..6`) | [section 5](design/identity.md#5-shape-density-and-elevation) |
| Radii | 4 / 6 / 8px (+ pill) | section 5 |
| Controls | 24 / 32 / 40px, panel header 44px, toolbar 52px, status bar 32px | section 5 |
| Elevation | three levels, floating layers only | section 5 |
| Focus | 2px ring, 2px offset, `--bd-focus` | section 5 |
| Motion | 120ms / 200ms / 320ms, disabled under `prefers-reduced-motion` | section 5 |

## Token reference

All tokens are CSS custom properties with the `--bd-` prefix, defined **only** in `styles/tokens.css`. A unit test recomputes the contrast table of `identity.md` from that file and fails if a `var(--bd-*)` is used but not defined or carries a fallback value.

### Stylesheet layout

| File | Contents |
|---|---|
| `styles/tokens.css` | shared tokens, both themes, reduced-motion override; imports metrics |
| `styles/metrics.css` | fixed widget geometry, imported before shared tokens |
| `styles/base.css` | `@font-face` (Inter), box-sizing, root text style, focus ring, scrollbars, tabular numerals |
| `styles/shell.css` | toolbar, body grid, panels, splitters, issues row, canvas host, application frame |
| `styles/primitives.css` | buttons, inputs, select, tabs, toggle, popover, tooltip, dialog, menu, toasts, drag ghost |
| `styles/panels.css` | layers, insert palette, inspector, value editor, issues and publish, media picker |
| `styles/left-panel.css` | template left panel and layers overrides |
| `styles/overlays.css` | template dialogs, toasts, issues and canvas states |

`src/styles.css` only `@import`s the partials in that order (used in development). The published `dist/styles.css` is the same partials inlined in the same order by `tooling/scripts/bundle-css.mjs`, with `dist/fonts/` (six woff2 files and `LICENSE-inter.txt`). Each area task of phase 13 owns one partial. `pnpm lint:css` (stylelint) forbids literal colours, spacing (`margin`, `padding`, `gap`) and `font-size` outside `tokens.css`.

### Theme

Light is the default block. Dark applies with `@media (prefers-color-scheme: dark)` unless the root has `data-theme="light"`, and always with `data-theme="dark"`. `data-theme="system"` (or no attribute) follows the system. Each block sets `color-scheme`, so native controls and scrollbars match; `scrollbar-width: thin` and `scrollbar-color` use `--bd-border-strong`. Radix renders menus, popovers, dialogs and tooltips in a portal on `<body>`; those classes receive the tokens directly (an explicit `data-theme` on the editor root does not reach them until the theme switch of PB-123 marks the portal container).

### Colour roles

Values per theme: [identity.md sections 3.2 and 3.3](design/identity.md#3-colour). Meaning:

| Role | Use |
|---|---|
| `bg` | app background, canvas stage, gutters |
| `surface`, `surface-2` | panels, dialogs, menus, inputs / wells, tiles, chips |
| `surface-hover`, `surface-selected` | hover of rows, tiles, menu items / selected row or tile |
| `border`, `border-strong` | decorative hairlines / boundary of interactive controls (>= 3:1) |
| `text`, `text-muted`, `text-subtle` | primary, labels, hints and placeholders |
| `accent`, `accent-hover`, `accent-soft`, `accent-text` | accent text and icons, hover, tinted background, text on solid accent |
| `primary`, `primary-hover`, `primary-text` | the solid primary button and toggles (theme-specific) |
| `focus` | focus ring |
| `danger`, `warning`, `success`, `info` (+ `-soft`) | semantic text/icon and matching tinted background; `danger-text` is text on a solid danger fill |
| `toolbar`, `toolbar-hover`, `toolbar-border`, `toolbar-text`, `toolbar-muted`, `toolbar-focus` | the themed toolbar |
| `shadow`, `overlay` | shadow colour for elevation, dialog backdrop |
| `canvas-page` | the white page drawn on the stage (user content, not chrome) |

### Scales

| Group | Tokens |
|---|---|
| Spacing | `--bd-space-half` = 2px; `--bd-space-1..6` = 4 / 8 / 12 / 16 / 24 / 32px (legacy `0`, `7`, `8` aliases remain) |
| Type size and line | `--bd-text-xs/sm/md/lg/xl` = 11 / 12 / 13 / 15 / 18px with `--bd-leading-xs/sm/md/lg/xl` = 16 / 16 / 20 / 24 / 24px |
| Weight | `--bd-weight-regular/medium/semibold` = 400 / 500 / 600 |
| Font | `--bd-font` (Inter, then the system stack), `--bd-font-mono`, `--bd-tracking-tight` (titles) |
| Radius | `--bd-radius-sm/md/lg/pill` = 4 / 6 / 8px / pill; `--bd-radius` = md |
| Controls | `--bd-control-sm/md/lg` = 24 / 32 / 40px; `--bd-panel-header` 44px; `--bd-toolbar-height` 52px; `--bd-statusbar-height` 32px |
| Borders | `--bd-border-width` 1px |
| Elevation | `--bd-elevation-1` (stage page), `-2` (menus, popovers, tooltips, toasts), `-3` (dialogs, overlays) |
| Motion | `--bd-duration-fast` 120ms, `--bd-duration-base` 200ms, `--bd-ease`; both durations become 0ms under `prefers-reduced-motion` |
| Layout (runtime) | `--bd-left`, `--bd-right` panel widths (defaults in `tokens.css`, set inline by the layout), `--bd-splitter-size`, `--bd-issues-height` |

### Type styles

| Style | Tokens | Weight | Used for |
|---|---|---|---|
| Title | `lg` | semibold | dialog titles, inspector component name, toolbar title |
| Body | `md` | regular | inputs, tree rows, menu items |
| Label | `sm` | medium / semibold | field labels, tabs, section headings |
| Caption | `xs` | regular | hints, slot suffix, counts |

Section headings are sentence case: no `text-transform`, no letter-spacing on small text. Numeric inputs use tabular numerals (`input[type="number"]` and the `.bd-tabular` utility).

### Fonts

Inter 400 / 500 / 600, self-hosted: latin and latin-ext (Polish) woff2 subsets in `src/fonts/`, `font-display: swap`, loaded through `@font-face` in `base.css`, so the host's CSP needs no font or style origin. The licence (SIL OFL 1.1) is `LICENSE-inter.txt` next to the files and in `dist/fonts/`. If the files fail to load the system stack takes over.

## Layout grid

Spacing sits on a 4px grid with a 2px fine step (`--bd-space-half`); use the fine steps only inside a control (chip padding, icon gaps).

| Element | Rule |
|---|---|
| Toolbar | 52px, themed, `--bd-space-4` side padding, gap `--bd-space-3` |
| Panel (PB-122) | 44px header (tabs or title), scroll body with `--bd-space-4` padding, optional sticky footer; panels are flat and separated by a 1px line. See [Panel anatomy](#panel-anatomy) |
| Between field groups | `--bd-space-4`; label to control `--bd-space-3` (`--bd-space-1` inside a compact field) |
| Rows (layers, menu items, list view) | `--bd-control-md` (32px) |
| Tiles | 76px high, `--bd-space-3` gaps |
| Splitters | 1px line with an 8px invisible hit area (PB-122) |
| Status bar (PB-122) | 32px |
| Narrow screens (PB-122, V9) | below 1100px the side panels are overlays; the canvas keeps at least 480px |

## Icons

Lucide, through `lucide-react`, imported **statically by name** (tree-shaken; no `DynamicIcon`, no whole-set import). Never a unicode arrow, triangle or emoji as an icon: a test scans `packages/editor/src` for them.

| Piece | Use |
|---|---|
| `<Icon name size label? />` (`ui/icon.tsx`) | the editor's own chrome; `name` is a key of a small curated map (`IconName`), so a typo fails typecheck |
| `Icon` names for the insert panel | `search`, `layout-grid` (view toggle) were added to the editor map for PB-125 |
| `<ComponentIcon meta size />` | a component's `meta.icon` (palette tile, layer row), resolved against a second curated map of about 75 names; a missing or unknown name gives the neutral `box` icon, **never a letter** |
| `<IconButton icon label />` | an icon-only button; `icon` is an `IconName`, `label` is required (accessible name and tooltip) |
| `<Select>` | shows a `chevron-down` icon itself |

Rules:

- **Sizes**: `sm` = 16px (rows, buttons, badges; the default), `md` = 20px (palette tiles). Stroke 1.5px at every size (`absoluteStrokeWidth`). Icons use `currentColor`, so the container sets the colour.
- **Colour per state**: `text-muted` at rest, `accent` for the selected layer row and palette tiles, `toolbar-muted` / `toolbar-text` in the toolbar.
- **Accessibility**: decorative icons are `aria-hidden` (the default). An icon that carries meaning on its own (a layer badge) is wrapped with a tooltip and a `role="img"` name from the messages catalog. Never make an icon the only name of a control.
- **Adding an icon**: one static import and one map entry in `ui/icon.tsx`; the unit test checks the name against lucide-react's export list. Use lucide's canonical kebab-case names.
- Sizes and colours in full: [identity.md section 7](design/identity.md#7-icons).

## Density rules

- Default control height is 32px (`--bd-control-md`); 24px only for icon buttons in dense rows and segmented items; 40px for dialog buttons.
- Body text is 13px, labels 12px, captions 11px. XL titles use 18px; fixed widget diagrams use the metric-specific sizes.
- Short controls (numbers, selects, toggles) go two to a row; long ones (text, rich text, lists) stack at full width. In the inspector this is `data-layout="row"` / `"stack"` on `.bd-field` (kinds boolean, select, number, icon are rows); the Content tab of a Heading and of a Button fits 800px of window height.
- Target: a 1280px screen shows the full toolbar on one row, and a typical component's Content tab fits the inspector without scrolling.

## Toolbar pattern

Three zones (PB-157). Left: back to the CMS, brand, left panel toggle, undo and redo, page chip (opens the page-options dialog). Centre: segmented breakpoint control and the zoom menu. Right: save indicator, locale chip, versions, icon-only Preview, more menu, right panel toggle, Publish. The more menu holds back to the CMS, versions, the light / dark / system theme switch, sample data, Shortcuts and Help (Help only with the host's `helpUrl`). Segmented controls (`.bd-segmented` / `.bd-segment`) use icons with the label and width in the tooltip. Publish is the only primary button. Collapse is driven by a `ResizeObserver` on the row (`use-overflow-level.ts`), never a media query. Floating layers portal into the editor root so they carry the theme.

## Editor layout (PB-157)

`app/layout.tsx` renders the toolbar, the body (left panel, stage, right panel) and the status bar.

- **Left panel**: tabs Blocks and Structure, a collapse button, and a rail with one icon per tab when collapsed. Blocks has a Blocks / Patterns switch, the insert target chip, Recently used, collapsible categories and flat highlighted search results; `/` focuses the search. Structure is the layers tree.
- **Right panel**: the inspector (Content, Style, Advanced tabs); collapsed, its rail shows the tabs as icons.
- **Panels** resize with splitters and collapse to rails; below 1100px they are overlays.
- **Stage**: the canvas, the empty-page state and the issues drawer, which opens inside the stage.
- **Status bar**: labelled breadcrumbs, the issues button with error and warning counts, the zoom menu and save state.
- **Toasts** (`ui/toast.tsx`): publish, delete and duplicate (with Undo), move, copy, save failure (with Retry now).

## Inspector and style tab (PB-157)

The inspector header shows the selected block; its tabs mark changed settings. Style sections (layout, position, size, spacing, typography, colours, background, border and corners, shadow) are collapsible, remember their open state and have an expand / collapse all toggle. Widgets include segmented controls, box-model and sides editors, a token picker, gradient fields and scrubbable number labels. Shadow cards are read-only: `effects.shadow` accepts only a theme token or `none`. The bind control keeps the Fixed / Data / Formula segmented control.

## Shortcuts (PB-157)

The registry is `shortcuts/map.ts`; the help dialog (`?`) lists every default, grouped General, Selection, Editing and View. Hosts override combinations by action id.

| Group | Shortcuts |
|---|---|
| General | Mod+S save, Mod+Z undo, Mod+Shift+Z / Mod+Y redo, `/` search blocks, `?` help |
| Selection | Escape selects the parent and clears the selection at the top, Mod+A select siblings |
| Editing | Mod+D duplicate, Delete / Backspace delete, Mod+C / X / V copy, cut, paste, Alt+Up / Down move |
| View | Mod+1 / 2 / 3 desktop, tablet, phone; Mod+. show or hide panels |

Deleting a block with descendants asks for confirmation; a block without descendants is removed at once with an Undo toast. Shortcuts work while focus is in the editor UI; forwarding from the canvas iframe is deferred. Mod+Shift+O (block outlines) is registered but has no effect, because the editor has no guides state.

## Do and don't

| Do | Don't |
|---|---|
| `padding: 0 var(--bd-space-4); color: var(--bd-text-muted);` | `padding: 0 12px; color: #5b6270;` (stylelint fails) |
| `font-size: var(--bd-text-sm); line-height: var(--bd-leading-sm);` | `font-size: 12px;` or `font: 12px/1.4 sans-serif;` |
| `background: var(--bd-surface-hover);` | `background: var(--bd-surface-hover, #eee);` (no fallbacks; an undefined token fails the unit test) |
| Add a token to `tokens.css` (both themes, contrast row in the test) when a role is missing | Introduce a one-off colour in a partial |
| `box-shadow: var(--bd-elevation-2);` on a floating layer | A shadow on a panel or on a card inside a panel |
| `--bd-border-strong` for the boundary of anything the user types into or toggles | `--bd-border` there (decorative, fails 3:1) |
| `--bd-text-subtle` for hints and placeholders | `opacity` on text to make it lighter (breaks contrast) |
| Selection: `--bd-surface-selected` plus a 2px `--bd-accent` bar | A row filled with the solid accent |
| One primary button per region | A second saturated button next to it |
| `useToast()` (PB-129) for messages | Another `position: fixed` message box |
| `transition: ... var(--bd-duration-fast) var(--bd-ease)` | Literal durations (they ignore `prefers-reduced-motion`) |

## Themes

Follows the system by default, with a light / dark / system switch remembered per user (V5, PB-123); a host that sets `data-theme` explicitly wins and the switch is hidden. `color-scheme` and scrollbar colours follow the theme (implemented in PB-119, see [Theme](#theme) above).

## Panel anatomy

The three side panels (Insert / Layers, Inspector) share one frame, provided by the shell (`EditorLayout` renders each slot inside a `Panel`, `ui/panel.tsx`). The panel is one column that scrolls as a whole; the header and the footer are `position: sticky`, so they stay in view.

| Piece | Class / component | Rule |
|---|---|---|
| Frame | `.bd-panel` / `<Panel as="aside">` | flat `--bd-surface` column, `overflow: auto`, no border of its own (the splitter is the line) |
| Header | `.bd-panel-header` / `<PanelHeader>` | 40px (`--bd-panel-header`), sticky top, 1px bottom line, holds tabs or a title; `--bd-space-4` side padding |
| Body | `.bd-panel-body` / `<PanelBody>` | `--bd-space-4` padding on every side |
| Footer | `.bd-panel-footer` / `<PanelFooter>` | optional, sticky bottom, 1px top line |

A panel renders `<PanelHeader>`, `<PanelBody>` and optionally `<PanelFooter>` as its top-level children. Until a panel adopts them (PB-125, PB-126, PB-127) its content simply fills the frame without padding. Never add a second scroll container inside a panel body unless the content needs one (a virtualised list).

The status bar (`.bd-issues-bar`, 32px, `--bd-statusbar-height`) sits below the columns: the issues toggle with error (`circle-alert`, `--bd-danger`) and warning (`triangle-alert`, `--bd-warning`) counts on the left; breakpoint, zoom and save state on the right. Below 1100px the panels are overlays (`.bd-body[data-narrow="true"]`) with `--bd-elevation-3`.

## Feedback surfaces (PB-129)

**Toasts.** `<ToastProvider>` (`ui/toast.tsx`) is mounted once, in the editor app's session, and renders the only toast region. It is the one component that positions a message with `position: fixed` (bottom centre, `z-index` above dialogs); every other message is inline or goes through it. Panels call the hook:

```ts
const toast = useToast();
toast.show({ message, detail?, variant?: 'success' | 'info' | 'warning' | 'error', id?, duration?: number | null, action?: { label, onSelect } });
toast.dismiss(id);
```

- The region holds two always-mounted lists: `role="status"` (polite) for success, info and warning, and `role="alert"` for errors, so screen readers announce what is added.
- Auto-dismiss after `TOAST_MS` (6s) unless `duration: null`; the timer pauses while the toast is hovered or holds focus. Showing a toast with the `id` of a visible one replaces it and restarts its timer (used by the clipboard, the preview error and the external-changes notice). Each toast has a dismiss button.
- Wired: the clipboard refusals (`clipboard`), the preview error (`preview`) and the external-changes notice (`external-changes`, persistent, with a "reload" action). The insert panel (PB-131) uses it too (id `insert`). The inspector, style inspector and layers panel still keep a local `role="status"` line: they clear it on the next successful edit, which a toast cannot do (follow-up in the PB-131 card).
- Inside a dialog, messages that belong to the dialog stay inline (`role="alert"` / `role="status"`), because a modal makes the region behind it inert.

**Dialogs.** `<Dialog title description footer hideClose>`: a header (title, description, close icon button), a body that scrolls on its own, and a right-aligned footer for the actions. Use `footer` for buttons; `hideClose` only for a dialog that has to be answered (the save conflict).

**Issues drawer and publish dialog.** The drawer groups findings under an Errors / Warnings / Notes heading (severity icon and count); each row shows the severity icon, the component icon and name (or "Document") and the message. The publish dialog shows the three counts as icon badges (the spoken text stays "N errors").

## Value controls (PB-128)

Controls for entering values live in `ui/primitives.tsx` and `styles/primitives.css`: `SegmentedControl` (a `fieldset` of `aria-pressed` buttons in a pill track; icon-only segments get a tooltip and an `aria-label`), `NumberUnitInput` (tabular numerals, unit menu, arrow-key steps) and `ColorSwatch` (decorative; paints only a colour notation). Use a segmented control for 2 to 5 short, mutually exclusive choices and a select beyond that. The style inspector's origin dot uses `--bd-accent` (set here), `--bd-warning` (inherited) and a hollow ring (default).

In the Style inspector, segments use compact padding and wrap instead of shrinking below their contents. Additional keyword selects occupy a separate row. Field headers can wrap their reset and override controls, and fields retain `min-width: 0` inside paired grids. `apps/playground/e2e/inspector-layout.spec.ts` checks text overflow and sibling intersections in both themes at 1280px and in the 1024px panel overlay, plus the small-screen notice below the editor's minimum width.

## Accessibility checks (PB-131)

- Every editor state of the visual baseline is checked with axe in both themes (`apps/playground/e2e/editor-a11y.spec.ts`); a new panel, dialog or state that joins the baseline joins that spec too.
- Text contrast is what axe measures, but icon-only controls are not: check them by eye in both themes. On the dark toolbar every control takes its colours from `--bd-toolbar-*` (a segmented control inside the toolbar overrides its inactive and hover colours; the generic segment colours belong on a light surface).
- A dialog returns focus to the element that had it when it opened (`Dialog` remembers it), so controlled dialogs need no trigger.


## Template v2 foundation (PB-151 / WP1)

The approved [template](design/template/README.md) supersedes PB-147 values and historical mockups.
Inter remains self-hosted; no template font links or demo runtime ship.

| Group | v2 tokens and values |
|---|---|
| Toolbar | light white with dark text; dark near-black with light text; focus follows theme |
| Primary | light #3f5ae0 / white; dark #8ea2f5 / #0f1636 |
| Override | light #a34f09 / #fdf0e3; dark #f2b552 / #3a2e15 (`override`, `override-soft`) |
| Toast | `toast-bg/text/accent/ok/err/hover`; inverted surface per theme |
| Canvas | `canvas-page/hover/select/guide/select-text`; white page, stable blue overlays |
| Type | `--font-sans`, `--font-mono`; legacy `--bd-font`, `--bd-font-mono` aliases; XL 18px / 24px |
| Spacing | half 2px; steps 1?6: 4 / 8 / 12 / 16 / 24 / 32px; legacy 0/7/8 alias half/5/6 |
| Geometry | controls 24/32/40px, compact 28px, toolbar 52px, header 44px, status 32px, right panel 340px |
| Motion | fast/base/slow 120/200/320ms; standard/enter/exit easing; all durations zero with reduced motion |
| Metrics | `styles/metrics.css`: fixed box model, 3?3 pad, curve, tiles and other widget geometry |

`tokens.css` imports `metrics.css` before theme declarations; both development and the recursive
bundler include it. Metrics contain geometry and references to colour tokens, never literal colours,
so the existing stylelint configuration needs no exception. Existing CSS token names remain available;
shared scale names take the approved v2 values. Later workers own shell/primitives/panels styling.

Canvas hover/guide are decorative cues: template hover is 2.98:1 on the white page.
The selection boundary and its label meet 3:1 and 4.5:1 respectively; hover is never the sole selection indicator.

### Legacy token migration (PB-151)

Legacy names remain available, but several changed meaning in template v2:
`--bd-space-2..6` changed from 6 / 8 / 12 / 16 / 20px to
8 / 12 / 16 / 24 / 32px; `--bd-control-md` from 28 to 32px,
`--bd-control-lg` from 32 to 40px, `--bd-panel-header` from 40 to 44px,
`--bd-statusbar-height` from 28 to 32px, `--bd-toolbar-height` from 44 to 52px,
and `--bd-right` from 320 to 340px. Fast/base durations changed from
100 / 160ms to 120 / 200ms. Light `--bd-toolbar`, `--bd-toolbar-hover`,
`--bd-toolbar-border`, `--bd-toolbar-text`, `--bd-toolbar-muted` and
`--bd-toolbar-focus` now describe the light toolbar palette. Dark `--bd-primary`,
`--bd-primary-hover` and `--bd-primary-text` now follow the dark accent palette
instead of retaining the light primary palette.
Rewritten consumers use the template scale. These names are not compatibility
aliases for the old geometry. Consumers retaining old geometry must use tokens
resolving to the old pixel values (for example `--bd-control-compact` for 28px).
The main-relative audit of pre-existing CSS/TSX files under `packages/editor/src`
and `apps/playground` found no untouched consumers of any changed alias,
including `--bd-control-md`; new WP3/WP5 partials use the template scale.
`--bd-space-0/7/8`, font aliases, easing and elevations retain their resolved
values despite changes in how they are expressed. `--bd-canvas-hover` is defined
but has no consumer.
