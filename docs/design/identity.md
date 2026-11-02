# Buildr editor - visual identity (PB-147)

Status: **approved template v2 (PB-151).** No maintainer was available to review this card, so the values below are the proposal of the implementing agent and are the input to PB-119 unless a maintainer changes them (see [Choices to revisit](#10-choices-to-revisit)). Decisions V1-V5 in [the phase 13 plan](../backlog/phase-13-editor-visual-polish.md) are the brief; this document is the answer.

Companion documents: [editor-design.md](../editor-design.md) (guidelines, first draft) and the mockups in [`mockups/`](mockups/).

**Character**: dense and precise. Cool, slightly blue-tinted neutrals; one indigo-blue accent used sparingly (selection, focus, the single primary action); a toolbar matching the theme; thin borders; shadows only on floating layers.

## 1. How PB-119 consumes this document

- Every block marked `css` in sections 3-6 is copy-pasteable into `styles/tokens.css` (selector shown above each block).
- Names keep the existing `--bd-*` prefix. Existing roles keep their name and meaning; new roles are marked *new*.
- Values are literal here; in `tokens.css` they are the only place literals may appear (V7).
- Section 8 is the contrast table. PB-119's unit test recomputes it from `tokens.css`; every row must stay `yes`.

## 2. Mockups

Hand-written SVG (no raster, no fonts embedded; they fall back to a system sans when Inter is not installed). Every colour in them is a token value from this document.

| Screen | Light | Dark |
|---|---|---|
| Full editor, Hero selected (toolbar, layers, canvas, inspector Content, status bar) | [editor-light.svg](mockups/editor-light.svg) | [editor-dark.svg](mockups/editor-dark.svg) |
| Insert palette: tiles (default) and list | [insert-light.svg](mockups/insert-light.svg) | [insert-dark.svg](mockups/insert-dark.svg) |
| Layers panel | [layers-light.svg](mockups/layers-light.svg) | [layers-dark.svg](mockups/layers-dark.svg) |
| Inspector: Content tab and Style tab (breakpoint control, box model, swatches, override chip) | [inspector-light.svg](mockups/inspector-light.svg) | [inspector-dark.svg](mockups/inspector-dark.svg) |
| Dialog (publish) over the editor | [dialog-light.svg](mockups/dialog-light.svg) | [dialog-dark.svg](mockups/dialog-dark.svg) |
| Narrow-screen overlay mode (below 1100px, layers as overlay) | [narrow-light.svg](mockups/narrow-light.svg) | [narrow-dark.svg](mockups/narrow-dark.svg) |

The status bar (28px: issue counts with icons, breakpoint and zoom, save state) is the bottom row of the editor, dialog and narrow mockups. Icons are drawn as simple 16px stroke icons (lucide-style, 1.5px stroke); PB-120 supplies the real ones.

## 3. Colour

### 3.1 Scales

Accent (indigo-blue, hue about 229). `accent-600` is the brand colour and the fill of the primary button.

| Step | Value |
|---|---|
| accent-50 | `#f1f4fe` |
| accent-100 | `#e2e8fc` |
| accent-200 | `#c7d2f9` |
| accent-300 | `#a3b3f4` |
| accent-400 | `#7a90ee` |
| accent-500 | `#5570e8` |
| accent-600 | `#3f5ae0` |
| accent-700 | `#3049bd` |
| accent-800 | `#293c94` |
| accent-900 | `#22326f` |

Neutrals (cool grey, hue about 225, low saturation).

| Step | Value |
|---|---|
| neutral-0 | `#ffffff` |
| neutral-50 | `#f7f8fa` |
| neutral-100 | `#f0f1f4` |
| neutral-150 | `#e8eaef` |
| neutral-200 | `#dfe1e7` |
| neutral-300 | `#c8ccd5` |
| neutral-400 | `#a3a8b5` |
| neutral-500 | `#7d8391` |
| neutral-600 | `#636a7b` |
| neutral-700 | `#4b5060` |
| neutral-800 | `#33363f` |
| neutral-850 | `#26282f` |
| neutral-900 | `#1c1d22` |
| neutral-950 | `#121317` |

### 3.2 Roles: light theme

Selector: `.buildr-editor` (and `.buildr-editor[data-theme="light"]`).

```css
  --bd-bg: #e9ebf0;
  --bd-surface: #ffffff;
  --bd-surface-2: #f4f5f8;
  --bd-surface-hover: #eceef2;
  --bd-surface-selected: #e2e8fc;
  --bd-border: #dfe1e7;
  --bd-border-strong: #7d8391;
  --bd-text: #1c1d22;
  --bd-text-muted: #4b5060;
  --bd-text-subtle: #5c6373;
  --bd-accent: #3f5ae0;
  --bd-accent-hover: #3049bd;
  --bd-accent-soft: #e2e8fc;
  --bd-accent-text: #ffffff;
  --bd-primary: #3f5ae0;
  --bd-primary-hover: #3049bd;
  --bd-primary-text: #ffffff;
  --bd-focus: #3f5ae0;
  --bd-override: #a34f09;
  --bd-override-soft: #fdf0e3;
  --bd-danger: #c0282d;
  --bd-danger-soft: #fdecec;
  --bd-warning: #8a5300;
  --bd-warning-soft: #fff3d9;
  --bd-toast-bg: #1c1e25;
  --bd-toast-text: #f4f5f8;
  --bd-toast-accent: #a3b3f4;
  --bd-toast-ok: #6fd39a;
  --bd-toast-err: #ff9a8f;
  --bd-toast-hover: rgb(255 255 255 / 12%);
  --bd-success: #1b7a3d;
  --bd-success-soft: #e4f5ea;
  --bd-info: #0b6b80;
  --bd-info-soft: #e0f3f7;
  --bd-toolbar: #ffffff;
  --bd-toolbar-hover: #eceef2;
  --bd-toolbar-border: #dfe1e7;
  --bd-toolbar-text: #1c1d22;
  --bd-toolbar-muted: #4b5060;
  --bd-canvas-page: #ffffff;
  --bd-canvas-hover: #7a90ee;
  --bd-canvas-select: #3f5ae0;
  --bd-canvas-guide: #a3b3f4;
  --bd-canvas-select-text: #ffffff;
  --bd-shadow: rgb(18 19 23 / 14%);
  --bd-overlay: rgb(18 19 23 / 50%);
  --bd-danger-text: #ffffff;
  --bd-toolbar-focus: #3f5ae0;
```

### 3.3 Roles: dark theme

Selector: `@media (prefers-color-scheme: dark) { .buildr-editor:not([data-theme="light"]) }` and `.buildr-editor[data-theme="dark"]`.

```css
  --bd-bg: #121317;
  --bd-surface: #1c1d22;
  --bd-surface-2: #23252b;
  --bd-surface-hover: #2b2d35;
  --bd-surface-selected: #243268;
  --bd-border: #33363f;
  --bd-border-strong: #7d8391;
  --bd-text: #ecedf1;
  --bd-text-muted: #b0b5c2;
  --bd-text-subtle: #9fa5b4;
  --bd-accent: #8ea2f5;
  --bd-accent-hover: #a3b3f4;
  --bd-accent-soft: #25325f;
  --bd-accent-text: #0f1636;
  --bd-primary: #8ea2f5;
  --bd-primary-hover: #a3b3f4;
  --bd-primary-text: #0f1636;
  --bd-focus: #a3b3f4;
  --bd-override: #f2b552;
  --bd-override-soft: #3a2e15;
  --bd-danger: #ff8a8a;
  --bd-danger-soft: #3d2226;
  --bd-warning: #f2b552;
  --bd-warning-soft: #3a2e15;
  --bd-toast-bg: #eef0f5;
  --bd-toast-text: #15161b;
  --bd-toast-accent: #3f5ae0;
  --bd-toast-ok: #1d7a47;
  --bd-toast-err: #b8322a;
  --bd-toast-hover: rgb(0 0 0 / 8%);
  --bd-success: #5fce85;
  --bd-success-soft: #173325;
  --bd-info: #5fc9dc;
  --bd-info-soft: #143038;
  --bd-toolbar: #0c0d10;
  --bd-toolbar-hover: #26282f;
  --bd-toolbar-border: #26282f;
  --bd-toolbar-text: #ecedf1;
  --bd-toolbar-muted: #a9aebb;
  --bd-canvas-page: #ffffff;
  --bd-canvas-hover: #7a90ee;
  --bd-canvas-select: #3f5ae0;
  --bd-canvas-guide: #a3b3f4;
  --bd-canvas-select-text: #ffffff;
  --bd-shadow: rgb(0 0 0 / 55%);
  --bd-overlay: rgb(0 0 0 / 60%);
  --bd-danger-text: #2a0b0e;
  --bd-toolbar-focus: #a3b3f4;
```

### 3.4 What the roles mean

| Role | Use |
|---|---|
| `bg` | app background, canvas stage, gutters |
| `surface` | panels, dialogs, menus, inputs |
| `surface-2` | wells: inputs' resting fill in dense groups, chips, code, tile background |
| `surface-hover` (*new*) | hover of rows, tiles, menu items |
| `surface-selected` (*new*) | selected layer row, selected tile, active list item |
| `border` | decorative hairlines (panel dividers, cards). Not a UI boundary. |
| `border-strong` (*new*) | boundary of interactive controls (inputs, checkboxes, segmented control): >= 3:1 |
| `text` / `text-muted` / `text-subtle` (*new*) | primary / secondary (labels) / tertiary (hints, placeholders, slot suffixes); all >= 4.5:1 on every surface |
| `accent` | accent used as text, icon, selection bar, link, focus-adjacent emphasis (differs per theme so it stays legible) |
| `accent-hover` (*new*) | hover of accent text/links |
| `accent-soft` (*new*) | tinted background for accent chips, icon wells, override pills |
| `accent-text` | text on a solid `accent` fill (e.g. the "Hero" label chip on the canvas) |
| `primary`, `primary-hover`, `primary-text` (*new*) | the solid primary button and toggles: theme-specific indigo fill and contrasting text |
| `focus` | focus ring colour |
| `danger`, `warning`, `success`, `info` | semantic text/icon colour on `surface`; `*-soft` is the matching tinted background for notices and badges (text on it is checked) |
| `toolbar*` (*new*) | the themed toolbar: fill, hover, border, text, muted text, its own focus ring (the toolbar is white in light, near-black in dark) |
| `shadow` | shadow colour used by the elevation tokens |

Semantic hues (red about 0, amber about 38, green about 145, teal about 190) are all at least 60 degrees away from the accent hue (229), and `info` is teal, not blue, so nothing semantic can be mistaken for the accent or for selection.

### 3.5 Theme-independent tokens

Selector: `.buildr-editor`. Keeps `--bd-radius: var(--bd-radius-md); `--bd-shadow` is replaced by the elevation tokens (below).

## 4. Typography

Inter, self-hosted (V3), weights 400/500/600 only. Fallback stack: `system-ui, -apple-system, "Segoe UI", sans-serif`. Numeric inputs use `font-variant-numeric: tabular-nums`.

```css
.buildr-editor {
  --bd-font: var(--font-sans);
  --bd-font-mono: var(--font-mono);

  --bd-text-xs: 11px;  --bd-leading-xs: 16px;   /* hints, badges, slot suffix, status bar counts */
  --bd-text-sm: 12px;  --bd-leading-sm: 16px;   /* labels, tabs, section headings, tooltips, buttons in dense bars */
  --bd-text-md: 13px;  --bd-leading-md: 20px;   /* body: inputs, tree rows, buttons, menu items */
  --bd-text-lg: 15px;  --bd-leading-lg: 24px;   /* panel/dialog titles, inspector component name */

  --bd-weight-regular: 400;
  --bd-weight-medium: 500;
  --bd-weight-semibold: 600;

  --bd-tracking-tight: -0.005em;  /* used with --bd-text-lg */
}
```

| Style | Size / line | Weight | Used for |
|---|---|---|---|
| Title | 15 / 24 | 600 | dialog titles, inspector header component name |
| Body | 13 / 20 | 400 | input values, tree rows, menu items, descriptions |
| Body strong | 13 / 20 | 600 | selected tree row, primary button, active tab |
| Label | 12 / 16 | 500 | field labels, tabs, section headings, segmented controls |
| Caption | 11 / 16 | 400 | hints, slot suffix, counts, status bar |
| Caption strong | 11 / 16 | 600 | chips, badges |

No uppercase text-transform and no letter-spacing on small text: section headings are sentence-case 12/600. Five different small sizes (audit A5) collapse into these four.

## 5. Shape, density and elevation

```css
.buildr-editor {
  --bd-elevation-1: 0 1px 2px rgb(18 19 23 / 14%);
  --bd-elevation-2: 0 4px 12px rgb(18 19 23 / 14%), 0 0 0 1px #dfe1e7;
  --bd-elevation-3: 0 12px 32px rgb(18 19 23 / 14%), 0 0 0 1px #dfe1e7;
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
  --bd-text-xs: 11px;
  --bd-leading-xs: 16px;
  --bd-text-sm: 12px;
  --bd-leading-sm: 16px;
  --bd-text-md: 13px;
  --bd-leading-md: 20px;
  --bd-text-lg: 15px;
  --bd-leading-lg: 24px;
  --bd-text-xl: 18px;
  --bd-leading-xl: 24px;
  --bd-weight-regular: 400;
  --bd-weight-medium: 500;
  --bd-weight-semibold: 600;
  --bd-space-1: 4px;
  --bd-space-2: 8px;
  --bd-space-3: 12px;
  --bd-space-4: 16px;
  --bd-space-5: 24px;
  --bd-space-6: 32px;
  --bd-radius-sm: 4px;
  --bd-radius-md: 6px;
  --bd-radius-lg: 8px;
  --bd-radius-xl: 12px;
  --bd-radius-pill: 999px;
  --bd-control-sm: 24px;
  --bd-control-md: 32px;
  --bd-control-lg: 40px;
  --bd-toolbar-height: 52px;
  --bd-panel-header: 44px;
  --bd-statusbar-height: 32px;
  --bd-space-half: 2px;
  --bd-icon-xs: 12px;
  --bd-icon-sm: 16px;
  --bd-control-xs: 20px;
  --bd-control-compact: 28px;
  --bd-radius-xs: 3px;
  --bd-left: 280px;
  --bd-right: 340px;
  --bd-rail: 48px;
  --bd-splitter-hit: 8px;
  --bd-border-width: 1px;
  --bd-focus-width: 2px;
  --bd-select-width: 2px;
  --bd-device-tablet: 768px;
  --bd-device-mobile: 390px;
  --bd-duration-fast: 120ms;
  --bd-duration-base: 200ms;
  --bd-duration-slow: 320ms;
  --bd-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --bd-ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --bd-ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --bd-z-canvas-overlay: 10;
  --bd-z-canvas-toolbar: 20;
  --bd-z-panel: 30;
  --bd-z-toolbar: 40;
  --bd-z-overlay-panel: 50;
  --bd-z-dropdown: 100;
  --bd-z-tooltip: 200;
  --bd-z-dialog: 300;
  --bd-z-toast: 400;
  --bd-font: var(--font-sans);
  --bd-font-mono: var(--font-mono);
  --bd-tracking-tight: -0.005em;
  --bd-space-0: var(--bd-space-half);
  --bd-space-7: var(--bd-space-5);
  --bd-space-8: var(--bd-space-6);
  --bd-radius: var(--bd-radius-md);
  --bd-issues-height: 160px;
  --bd-splitter-size: 1px;
  --bd-ease: var(--bd-ease-standard);
}
```

Rules:

- Borders are 1px `--bd-border` for structure (panel dividers, cards) and 1px `--bd-border-strong` for interactive controls. Panels are separated by a 1px line, never by a heavy bar.
- Elevation is used **only** on floating layers (menus, popovers, tooltips, toasts, dialogs, the narrow-screen overlay) and the page on the stage. Panels themselves are flat.
- Panel body padding is `--bd-space-5` (16px) horizontally, `--bd-space-4` (12px) between field groups, `--bd-space-3` (8px) between label and control.
- Row height is `--bd-control-md` (32px) for tree rows, menu items and list-view entries; tiles are 76px high with `--bd-space-3` gaps.

### Focus ring

```css
.buildr-editor :focus-visible {
  outline: 2px solid var(--bd-focus);
  outline-offset: 2px;
}
.buildr-editor .bd-toolbar :focus-visible { outline-color: var(--bd-toolbar-focus); }
```

2px, offset 2px, `--bd-focus` (>= 3:1 against `surface`, `bg` and, in the toolbar, `--bd-toolbar-focus` against `--bd-toolbar`). Inside clipped containers (tree rows, tiles) use `outline-offset: -2px`. Never remove an outline without replacing it. Selection is not focus: selected rows use `surface-selected` plus a 2px `accent` left bar; focus is always the ring.

## 6. Component states (summary for PB-119 and later)

| Element | Rest | Hover | Active/selected | Disabled |
|---|---|---|---|---|
| Primary button | `primary` fill, `primary-text` | `primary-hover` | same as hover + inset shadow none | 40% opacity, no hover |
| Secondary button | `surface`, 1px `border-strong`, `text` | `surface-hover` | `surface-selected` | 40% opacity |
| Toolbar button | transparent, `toolbar-text` | `toolbar-hover` | `primary` fill (segmented control) | 40% opacity |
| Input | `surface`, 1px `border-strong` | border stays, no colour change | focus ring | `surface-2`, `text-subtle` |
| Row / tile | transparent (tile: `surface-2` + `border`) | `surface-hover` | `surface-selected` + 2px `accent` bar | 40% opacity |
| Toggle | off: `border-strong` track; on: `primary` | - | - | 40% opacity |

## 7. Icons

Lucide, 16px in dense rows, 20px in palette tiles, 1.5px stroke, `currentColor`. Colour: `text-muted` at rest, `accent` for the selected row and palette tiles, `toolbar-muted`/`toolbar-text` in the toolbar. Full rules are PB-120's.

## 8. Contrast

Computed with the script in [Appendix A](#appendix-a-contrast-script) (WCAG 2.x relative luminance). Text pairs need 4.5:1, UI boundaries (control borders, focus ring, selected/primary fills against their surroundings) need 3:1. Every row passes; **all pairs are below re-verified by PB-119's unit test**.

Not covered by a ratio (deliberately): `border` (decorative hairlines between regions; every control that must be findable uses `border-strong`), disabled controls (WCAG exempts them) and the placeholder page content drawn on the canvas (it is the user's page, not editor chrome).

### Light theme

| Kind | Foreground | Background | Ratio | Min | Pass |
|---|---|---|---|---|---|
| text | `--bd-text` #1c1d22 | `--bd-surface` #ffffff | 16.82 | 4.5 | yes |
| text | `--bd-text` #1c1d22 | `--bd-surface-2` #f4f5f8 | 15.43 | 4.5 | yes |
| text | `--bd-text` #1c1d22 | `--bd-bg` #e9ebf0 | 14.11 | 4.5 | yes |
| text | `--bd-text` #1c1d22 | `--bd-surface-hover` #eceef2 | 14.48 | 4.5 | yes |
| text | `--bd-text` #1c1d22 | `--bd-surface-selected` #e2e8fc | 13.77 | 4.5 | yes |
| text | `--bd-text-muted` #4b5060 | `--bd-surface` #ffffff | 8.03 | 4.5 | yes |
| text | `--bd-text-muted` #4b5060 | `--bd-surface-2` #f4f5f8 | 7.36 | 4.5 | yes |
| text | `--bd-text-muted` #4b5060 | `--bd-bg` #e9ebf0 | 6.73 | 4.5 | yes |
| text | `--bd-text-muted` #4b5060 | `--bd-surface-hover` #eceef2 | 6.91 | 4.5 | yes |
| text | `--bd-text-muted` #4b5060 | `--bd-surface-selected` #e2e8fc | 6.57 | 4.5 | yes |
| text | `--bd-text-subtle` #5c6373 | `--bd-surface` #ffffff | 6.02 | 4.5 | yes |
| text | `--bd-text-subtle` #5c6373 | `--bd-surface-2` #f4f5f8 | 5.52 | 4.5 | yes |
| text | `--bd-text-subtle` #5c6373 | `--bd-bg` #e9ebf0 | 5.05 | 4.5 | yes |
| text | `--bd-text-subtle` #5c6373 | `--bd-surface-hover` #eceef2 | 5.18 | 4.5 | yes |
| text | `--bd-text-subtle` #5c6373 | `--bd-surface-selected` #e2e8fc | 4.93 | 4.5 | yes |
| text | `--bd-text` #1c1d22 | `--bd-accent-soft` #e2e8fc | 13.77 | 4.5 | yes |
| text | `--bd-primary-text` #ffffff | `--bd-primary` #3f5ae0 | 5.60 | 4.5 | yes |
| text | `--bd-primary-text` #ffffff | `--bd-primary-hover` #3049bd | 7.46 | 4.5 | yes |
| text | `--bd-accent` #3f5ae0 | `--bd-surface` #ffffff | 5.60 | 4.5 | yes |
| text | `--bd-accent` #3f5ae0 | `--bd-surface-2` #f4f5f8 | 5.14 | 4.5 | yes |
| text | `--bd-accent` #3f5ae0 | `--bd-accent-soft` #e2e8fc | 4.58 | 4.5 | yes |
| text | `--bd-accent` #3f5ae0 | `--bd-surface-selected` #e2e8fc | 4.58 | 4.5 | yes |
| text | `--bd-accent-text` #ffffff | `--bd-accent` #3f5ae0 | 5.60 | 4.5 | yes |
| text | `--bd-danger` #c0282d | `--bd-surface` #ffffff | 5.86 | 4.5 | yes |
| text | `--bd-danger` #c0282d | `--bd-danger-soft` #fdecec | 5.13 | 4.5 | yes |
| text | `--bd-warning` #8a5300 | `--bd-surface` #ffffff | 6.33 | 4.5 | yes |
| text | `--bd-warning` #8a5300 | `--bd-warning-soft` #fff3d9 | 5.75 | 4.5 | yes |
| text | `--bd-success` #1b7a3d | `--bd-surface` #ffffff | 5.39 | 4.5 | yes |
| text | `--bd-success` #1b7a3d | `--bd-success-soft` #e4f5ea | 4.76 | 4.5 | yes |
| text | `--bd-info` #0b6b80 | `--bd-surface` #ffffff | 6.12 | 4.5 | yes |
| text | `--bd-info` #0b6b80 | `--bd-info-soft` #e0f3f7 | 5.35 | 4.5 | yes |
| text | `--bd-toolbar-text` #1c1d22 | `--bd-toolbar` #ffffff | 16.82 | 4.5 | yes |
| text | `--bd-toolbar-text` #1c1d22 | `--bd-toolbar-hover` #eceef2 | 14.48 | 4.5 | yes |
| text | `--bd-toolbar-muted` #4b5060 | `--bd-toolbar` #ffffff | 8.03 | 4.5 | yes |
| text | `--bd-toolbar-muted` #4b5060 | `--bd-toolbar-hover` #eceef2 | 6.91 | 4.5 | yes |
| boundary | `--bd-border-strong` #7d8391 | `--bd-surface` #ffffff | 3.80 | 3 | yes |
| boundary | `--bd-border-strong` #7d8391 | `--bd-surface-2` #f4f5f8 | 3.49 | 3 | yes |
| boundary | `--bd-border-strong` #7d8391 | `--bd-bg` #e9ebf0 | 3.19 | 3 | yes |
| boundary | `--bd-focus` #3f5ae0 | `--bd-surface` #ffffff | 5.60 | 3 | yes |
| boundary | `--bd-focus` #3f5ae0 | `--bd-bg` #e9ebf0 | 4.69 | 3 | yes |
| boundary | `--bd-toolbar-focus` #3f5ae0 | `--bd-toolbar` #ffffff | 5.60 | 3 | yes |
| boundary | `--bd-accent` #3f5ae0 | `--bd-surface` #ffffff | 5.60 | 3 | yes |
| boundary | `--bd-accent` #3f5ae0 | `--bd-bg` #e9ebf0 | 4.69 | 3 | yes |
| boundary | `--bd-primary` #3f5ae0 | `--bd-surface` #ffffff | 5.60 | 3 | yes |
| boundary | `--bd-primary` #3f5ae0 | `--bd-bg` #e9ebf0 | 4.69 | 3 | yes |


### Dark theme

| Kind | Foreground | Background | Ratio | Min | Pass |
|---|---|---|---|---|---|
| text | `--bd-text` #ecedf1 | `--bd-surface` #1c1d22 | 14.38 | 4.5 | yes |
| text | `--bd-text` #ecedf1 | `--bd-surface-2` #23252b | 13.09 | 4.5 | yes |
| text | `--bd-text` #ecedf1 | `--bd-bg` #121317 | 15.87 | 4.5 | yes |
| text | `--bd-text` #ecedf1 | `--bd-surface-hover` #2b2d35 | 11.74 | 4.5 | yes |
| text | `--bd-text` #ecedf1 | `--bd-surface-selected` #243268 | 10.37 | 4.5 | yes |
| text | `--bd-text-muted` #b0b5c2 | `--bd-surface` #1c1d22 | 8.20 | 4.5 | yes |
| text | `--bd-text-muted` #b0b5c2 | `--bd-surface-2` #23252b | 7.47 | 4.5 | yes |
| text | `--bd-text-muted` #b0b5c2 | `--bd-bg` #121317 | 9.05 | 4.5 | yes |
| text | `--bd-text-muted` #b0b5c2 | `--bd-surface-hover` #2b2d35 | 6.69 | 4.5 | yes |
| text | `--bd-text-muted` #b0b5c2 | `--bd-surface-selected` #243268 | 5.91 | 4.5 | yes |
| text | `--bd-text-subtle` #9fa5b4 | `--bd-surface` #1c1d22 | 6.82 | 4.5 | yes |
| text | `--bd-text-subtle` #9fa5b4 | `--bd-surface-2` #23252b | 6.21 | 4.5 | yes |
| text | `--bd-text-subtle` #9fa5b4 | `--bd-bg` #121317 | 7.53 | 4.5 | yes |
| text | `--bd-text-subtle` #9fa5b4 | `--bd-surface-hover` #2b2d35 | 5.57 | 4.5 | yes |
| text | `--bd-text-subtle` #9fa5b4 | `--bd-surface-selected` #243268 | 4.92 | 4.5 | yes |
| text | `--bd-text` #ecedf1 | `--bd-accent-soft` #25325f | 10.56 | 4.5 | yes |
| text | `--bd-primary-text` #0f1636 | `--bd-primary` #8ea2f5 | 7.27 | 4.5 | yes |
| text | `--bd-primary-text` #0f1636 | `--bd-primary-hover` #a3b3f4 | 8.68 | 4.5 | yes |
| text | `--bd-accent` #8ea2f5 | `--bd-surface` #1c1d22 | 6.92 | 4.5 | yes |
| text | `--bd-accent` #8ea2f5 | `--bd-surface-2` #23252b | 6.30 | 4.5 | yes |
| text | `--bd-accent` #8ea2f5 | `--bd-accent-soft` #25325f | 5.08 | 4.5 | yes |
| text | `--bd-accent` #8ea2f5 | `--bd-surface-selected` #243268 | 4.99 | 4.5 | yes |
| text | `--bd-accent-text` #0f1636 | `--bd-accent` #8ea2f5 | 7.27 | 4.5 | yes |
| text | `--bd-danger` #ff8a8a | `--bd-surface` #1c1d22 | 7.41 | 4.5 | yes |
| text | `--bd-danger` #ff8a8a | `--bd-danger-soft` #3d2226 | 6.36 | 4.5 | yes |
| text | `--bd-warning` #f2b552 | `--bd-surface` #1c1d22 | 9.22 | 4.5 | yes |
| text | `--bd-warning` #f2b552 | `--bd-warning-soft` #3a2e15 | 7.28 | 4.5 | yes |
| text | `--bd-success` #5fce85 | `--bd-surface` #1c1d22 | 8.54 | 4.5 | yes |
| text | `--bd-success` #5fce85 | `--bd-success-soft` #173325 | 6.93 | 4.5 | yes |
| text | `--bd-info` #5fc9dc | `--bd-surface` #1c1d22 | 8.71 | 4.5 | yes |
| text | `--bd-info` #5fc9dc | `--bd-info-soft` #143038 | 7.20 | 4.5 | yes |
| text | `--bd-toolbar-text` #ecedf1 | `--bd-toolbar` #0c0d10 | 16.61 | 4.5 | yes |
| text | `--bd-toolbar-text` #ecedf1 | `--bd-toolbar-hover` #26282f | 12.58 | 4.5 | yes |
| text | `--bd-toolbar-muted` #a9aebb | `--bd-toolbar` #0c0d10 | 8.75 | 4.5 | yes |
| text | `--bd-toolbar-muted` #a9aebb | `--bd-toolbar-hover` #26282f | 6.63 | 4.5 | yes |
| boundary | `--bd-border-strong` #7d8391 | `--bd-surface` #1c1d22 | 4.43 | 3 | yes |
| boundary | `--bd-border-strong` #7d8391 | `--bd-surface-2` #23252b | 4.03 | 3 | yes |
| boundary | `--bd-border-strong` #7d8391 | `--bd-bg` #121317 | 4.89 | 3 | yes |
| boundary | `--bd-focus` #a3b3f4 | `--bd-surface` #1c1d22 | 8.26 | 3 | yes |
| boundary | `--bd-focus` #a3b3f4 | `--bd-bg` #121317 | 9.12 | 3 | yes |
| boundary | `--bd-toolbar-focus` #a3b3f4 | `--bd-toolbar` #0c0d10 | 9.54 | 3 | yes |
| boundary | `--bd-accent` #8ea2f5 | `--bd-surface` #1c1d22 | 6.92 | 3 | yes |
| boundary | `--bd-accent` #8ea2f5 | `--bd-bg` #121317 | 7.63 | 3 | yes |
| boundary | `--bd-primary` #8ea2f5 | `--bd-surface` #1c1d22 | 6.92 | 3 | yes |
| boundary | `--bd-primary` #8ea2f5 | `--bd-bg` #121317 | 7.63 | 3 | yes |


## 9. "Not WordPress" check

The palette is inspired by the general look of block editors (blue accent, near-black toolbar, neutral greys); nothing else is taken.

- [x] No WordPress, Gutenberg or Automattic names, logos, glyphs, or wording appear in the palette, the mockups, the tokens or the UI copy.
- [x] The accent is our own: `#3f5ae0` (scale in section 3.1). It is not the block editor's blue, and neither are any of the neutrals (`#1c1d22`, `#5c6373`, `#dfe1e7`, `#f0f1f4`), which are cool-tinted rather than neutral grey.
- [x] Token names are `--bd-*` (Buildr), not the block editor's `--wp-*`.
- [x] The layout is our own composition (three panels, a status bar, a segmented breakpoint control, a box-model widget); the mockups reuse no proprietary artwork.
- [x] Inter (OFL) and lucide (ISC) are the only third-party assets; both are permissively licensed and credited in PB-119/PB-120.
- Review rule for later tasks: no PR may introduce a string, icon or colour that is documented as a WordPress trademark or brand asset.

## 10. Choices to revisit

These are the judgement calls a maintainer may want to override. Changing any of them means editing the tables above and re-running the appendix script; PB-119 has not started, so the cost is nil.

1. **Accent hue and value** (`#3f5ae0`, indigo-blue). Alternative: a slightly more violet or teal accent.
2. **Primary button colour is the theme-specific** (`#3f5ae0` with white text, 5.6:1), while `accent` (text/icons) is lighter in dark. Alternative: a lighter primary in dark with dark text.
3. **The toolbar is white in light, near-black in dark**, and darker than the panels in the dark theme (`#0c0d10` vs `#1c1d22`).
4. **Cool-tinted neutrals** instead of pure greys.
5. **`border` is decorative and low contrast**; only `border-strong` (`#7d8391`, a fairly visible grey) meets 3:1. Alternative: one border colour at 3:1 everywhere (heavier look).
6. **Spacing scale starts at 2px** (2/4/6/8/12/16/20/24/32), as in the card; the 6px step is used sparingly.
7. **Dialog radius 8px, control radius 6px** (upper end of V4's 4-6px range for controls).
8. **Info is teal**, so it is never the accent blue.
9. **Focus ring** is 2px with 1px offset rather than a box-shadow ring, so it also works with forced-colours mode.

## Appendix A: contrast verification

Run `pnpm test --filter @next-buildr/editor`. `styles/tokens.test.ts` computes WCAG
ratios directly from the shipped light/dark declarations, including override, toast and canvas roles.

## Template v2 foundation (PB-151 / WP1)

The approved [template](template/README.md) supersedes PB-147 values and historical mockups.
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
