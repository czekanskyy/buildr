# Editor design guidelines

Status: **reference (PB-119).** Token values are shipped in `packages/editor/src/styles/tokens.css`; the icon rules (PB-120) are in [Icons](#icons). The source of the approved values is [design/identity.md](design/identity.md); mockups are in [design/mockups/](design/mockups/).

Every editor task in [phase 13](backlog/phase-13-editor-visual-polish.md) references this document. Where it disagrees with a mockup, the token tables in `identity.md` win.

## Principles

1. **Dense and precise.** 28px controls, 4-6px radii, thin borders, 12-13px text. The editor is a tool used for hours; it should show as much of the document and its properties as fit, calmly.
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
| Toolbar | dark in both themes, own `toolbar*` tokens | section 3.4 |
| Semantic | danger, warning, success, info (teal), each with a `*-soft` background | section 3.4 |
| Type | Inter 400/500/600 at 11 / 12 / 13 / 15px, line heights 16 / 16 / 20 / 24 | [section 4](design/identity.md#4-typography) |
| Spacing | 2 4 6 8 12 16 20 24 32 (`--bd-space-0..8`) | [section 5](design/identity.md#5-shape-density-and-elevation) |
| Radii | 4 / 6 / 8px (+ pill) | section 5 |
| Controls | 24 / 28 / 32px, panel header 40px, toolbar 44px, status bar 28px | section 5 |
| Elevation | three levels, floating layers only | section 5 |
| Focus | 2px ring, 1px offset, `--bd-focus` | section 5 |
| Motion | 100ms / 160ms, disabled under `prefers-reduced-motion` | section 5 |

## Token reference

All tokens are CSS custom properties with the `--bd-` prefix, defined **only** in `styles/tokens.css`. A unit test recomputes the contrast table of `identity.md` from that file and fails if a `var(--bd-*)` is used but not defined or carries a fallback value.

### Stylesheet layout

| File | Contents |
|---|---|
| `styles/tokens.css` | every token, both themes, reduced-motion override |
| `styles/base.css` | `@font-face` (Inter), box-sizing, root text style, focus ring, scrollbars, tabular numerals |
| `styles/shell.css` | toolbar, body grid, panels, splitters, issues row, canvas host, application frame |
| `styles/primitives.css` | buttons, inputs, select, tabs, toggle, popover, tooltip, dialog, menu, toasts, drag ghost |
| `styles/panels.css` | layers, insert palette, inspector, value editor, issues and publish, media picker |

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
| `primary`, `primary-hover`, `primary-text` | the solid primary button and toggles (same in both themes) |
| `focus` | focus ring |
| `danger`, `warning`, `success`, `info` (+ `-soft`) | semantic text/icon and matching tinted background; `danger-text` is text on a solid danger fill |
| `toolbar`, `toolbar-hover`, `toolbar-border`, `toolbar-text`, `toolbar-muted`, `toolbar-focus` | the dark toolbar (dark in both themes) |
| `shadow`, `overlay` | shadow colour for elevation, dialog backdrop |
| `canvas-page` | the white page drawn on the stage (user content, not chrome) |

### Scales

| Group | Tokens |
|---|---|
| Spacing | `--bd-space-0..8` = 2 / 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32px |
| Type size and line | `--bd-text-xs/sm/md/lg` = 11 / 12 / 13 / 15px with `--bd-leading-xs/sm/md/lg` = 16 / 16 / 20 / 24px |
| Weight | `--bd-weight-regular/medium/semibold` = 400 / 500 / 600 |
| Font | `--bd-font` (Inter, then the system stack), `--bd-font-mono`, `--bd-tracking-tight` (titles) |
| Radius | `--bd-radius-sm/md/lg/pill` = 4 / 6 / 8px / pill; `--bd-radius` = md |
| Controls | `--bd-control-sm/md/lg` = 24 / 28 / 32px; `--bd-panel-header` 40px; `--bd-toolbar-height` 44px; `--bd-statusbar-height` 28px |
| Borders | `--bd-border-width` 1px |
| Elevation | `--bd-elevation-1` (stage page), `-2` (menus, popovers, tooltips, toasts), `-3` (dialogs, overlays) |
| Motion | `--bd-duration-fast` 100ms, `--bd-duration-base` 160ms, `--bd-ease`; both durations become 0ms under `prefers-reduced-motion` |
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

Spacing sits on a 4px grid with 2px and 6px as fine steps (`--bd-space-0`, `-2`); use the fine steps only inside a control (chip padding, icon gaps).

| Element | Rule |
|---|---|
| Toolbar | 44px, dark, `--bd-space-4` side padding, gap `--bd-space-3` |
| Panel (PB-122) | 40px header (tabs or title), scroll body with `--bd-space-4` padding, optional sticky footer; panels are flat and separated by a 1px line. See [Panel anatomy](#panel-anatomy) |
| Between field groups | `--bd-space-4`; label to control `--bd-space-3` (`--bd-space-1` inside a compact field) |
| Rows (layers, menu items, list view) | `--bd-control-md` (28px) |
| Tiles | 68px high, `--bd-space-3` gaps |
| Splitters | 1px line with an 8px invisible hit area (PB-122) |
| Status bar (PB-122) | 28px |
| Narrow screens (PB-122, V9) | below 1100px the side panels are overlays; the canvas keeps at least 480px |

## Icons

Lucide, through `lucide-react`, imported **statically by name** (tree-shaken; no `DynamicIcon`, no whole-set import). Never a unicode arrow, triangle or emoji as an icon: a test scans `packages/editor/src` for them.

| Piece | Use |
|---|---|
| `<Icon name size label? />` (`ui/icon.tsx`) | the editor's own chrome; `name` is a key of a small curated map (`IconName`), so a typo fails typecheck |
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

- Default control height is 28px (`--bd-control-md`); 24px only for icon buttons in dense rows and segmented items; 32px for dialog buttons.
- Body text is 13px, labels 12px, captions 11px. Nothing below 11px; nothing between the four sizes.
- Short controls (numbers, selects, toggles) go two to a row; long ones (text, rich text, lists) stack at full width. In the inspector this is `data-layout="row"` / `"stack"` on `.bd-field` (kinds boolean, select, number, icon are rows); the Content tab of a Heading and of a Button fits 800px of window height.
- Target: a 1280px screen shows the full toolbar on one row, and a typical component's Content tab fits the inspector without scrolling.

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

The status bar (`.bd-issues-bar`, 28px, `--bd-statusbar-height`) sits below the columns: the issues toggle with error (`circle-alert`, `--bd-danger`) and warning (`triangle-alert`, `--bd-warning`) counts on the left; breakpoint, zoom and save state on the right. Below 1100px the panels are overlays (`.bd-body[data-narrow="true"]`) with `--bd-elevation-3`.

## Feedback surfaces (PB-129)

**Toasts.** `<ToastProvider>` (`ui/toast.tsx`) is mounted once, in the editor app's session, and renders the only toast region. It is the one component that positions a message with `position: fixed` (bottom centre, `z-index` above dialogs); every other message is inline or goes through it. Panels call the hook:

```ts
const toast = useToast();
toast.show({ message, detail?, variant?: 'success' | 'info' | 'warning' | 'error', id?, duration?: number | null, action?: { label, onSelect } });
toast.dismiss(id);
```

- The region holds two always-mounted lists: `role="status"` (polite) for success, info and warning, and `role="alert"` for errors, so screen readers announce what is added.
- Auto-dismiss after `TOAST_MS` (6s) unless `duration: null`; the timer pauses while the toast is hovered or holds focus. Showing a toast with the `id` of a visible one replaces it and restarts its timer (used by the clipboard, the preview error and the external-changes notice). Each toast has a dismiss button.
- Wired: the clipboard refusals (`clipboard`), the preview error (`preview`) and the external-changes notice (`external-changes`, persistent, with a "reload" action). PB-125 (insert panel) and PB-127 (inspector) replace their local notice `div`s with `useToast()`.
- Inside a dialog, messages that belong to the dialog stay inline (`role="alert"` / `role="status"`), because a modal makes the region behind it inert.

**Dialogs.** `<Dialog title description footer hideClose>`: a header (title, description, close icon button), a body that scrolls on its own, and a right-aligned footer for the actions. Use `footer` for buttons; `hideClose` only for a dialog that has to be answered (the save conflict).

**Issues drawer and publish dialog.** The drawer groups findings under an Errors / Warnings / Notes heading (severity icon and count); each row shows the severity icon, the component icon and name (or "Document") and the message. The publish dialog shows the three counts as icon badges (the spoken text stays "N errors").
