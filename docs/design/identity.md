# Buildr editor - visual identity (PB-147)

Status: **proposed, treated as approved by default.** No maintainer was available to review this card, so the values below are the proposal of the implementing agent and are the input to PB-119 unless a maintainer changes them (see [Choices to revisit](#10-choices-to-revisit)). Decisions V1-V5 in [the phase 13 plan](../backlog/phase-13-editor-visual-polish.md) are the brief; this document is the answer.

Companion documents: [editor-design.md](../editor-design.md) (guidelines, first draft) and the mockups in [`mockups/`](mockups/).

**Character**: dense and precise. Cool, slightly blue-tinted neutrals; one indigo-blue accent used sparingly (selection, focus, the single primary action); a dark toolbar in both themes; thin borders; shadows only on floating layers.

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
  --bd-focus: #3f5ae0;
  --bd-danger: #c0282d;
  --bd-danger-soft: #fdecec;
  --bd-warning: #8a5300;
  --bd-warning-soft: #fff3d9;
  --bd-success: #1b7a3d;
  --bd-success-soft: #e4f5ea;
  --bd-info: #0b6b80;
  --bd-info-soft: #e0f3f7;
  --bd-toolbar: #1c1d22;
  --bd-toolbar-hover: #33363f;
  --bd-toolbar-border: #33363f;
  --bd-toolbar-text: #f0f1f4;
  --bd-toolbar-muted: #b4b9c6;
  --bd-toolbar-focus: #a3b3f4;
  --bd-shadow: rgb(18 19 23 / 14%);
  --bd-primary: #3f5ae0;
  --bd-primary-text: #ffffff;
  --bd-primary-hover: #3049bd;
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
  --bd-focus: #a3b3f4;
  --bd-danger: #ff8a8a;
  --bd-danger-soft: #3d2226;
  --bd-warning: #f2b552;
  --bd-warning-soft: #3a2e15;
  --bd-success: #5fce85;
  --bd-success-soft: #173325;
  --bd-info: #5fc9dc;
  --bd-info-soft: #143038;
  --bd-toolbar: #0c0d10;
  --bd-toolbar-hover: #26282f;
  --bd-toolbar-border: #26282f;
  --bd-toolbar-text: #ecedf1;
  --bd-toolbar-muted: #a9aebb;
  --bd-toolbar-focus: #a3b3f4;
  --bd-shadow: rgb(0 0 0 / 55%);
  --bd-primary-hover: #3049bd;
  --bd-primary: #3f5ae0;
  --bd-primary-text: #ffffff;
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
| `primary`, `primary-hover`, `primary-text` (*new*) | the solid primary button and toggles: the same `#3f5ae0` / white in both themes so the primary action looks identical everywhere |
| `focus` | focus ring colour |
| `danger`, `warning`, `success`, `info` | semantic text/icon colour on `surface`; `*-soft` is the matching tinted background for notices and badges (text on it is checked) |
| `toolbar*` (*new*) | the dark toolbar: fill, hover, border, text, muted text, its own focus ring (the toolbar is dark in both themes) |
| `shadow` | shadow colour used by the elevation tokens |

Semantic hues (red about 0, amber about 38, green about 145, teal about 190) are all at least 60 degrees away from the accent hue (229), and `info` is teal, not blue, so nothing semantic can be mistaken for the accent or for selection.

### 3.5 Theme-independent tokens

Selector: `.buildr-editor`. Keeps `--bd-radius: 6px` (alias of `--bd-radius-md`), `--bd-toolbar-height: 44px` and `--bd-issues-height: 160px` from the current stylesheet; `--bd-shadow` is replaced by the elevation tokens (below).

## 4. Typography

Inter, self-hosted (V3), weights 400/500/600 only. Fallback stack: `system-ui, -apple-system, "Segoe UI", sans-serif`. Numeric inputs use `font-variant-numeric: tabular-nums`.

```css
.buildr-editor {
  --bd-font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --bd-font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;

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
  /* spacing: 2 4 6 8 12 16 20 24 32 */
  --bd-space-0: 2px;  --bd-space-1: 4px;  --bd-space-2: 6px;  --bd-space-3: 8px;  --bd-space-4: 12px;
  --bd-space-5: 16px; --bd-space-6: 20px; --bd-space-7: 24px; --bd-space-8: 32px;

  --bd-radius-sm: 4px;   /* checkbox, chip inner, tooltip, segmented item */
  --bd-radius-md: 6px;   /* inputs, buttons, tiles, menus, rows */
  --bd-radius-lg: 8px;   /* dialogs, popovers, cards */
  --bd-radius-pill: 999px; /* status pill, override chip, toggle */

  --bd-control-sm: 24px;  /* icon buttons in dense rows, segmented items */
  --bd-control-md: 28px;  /* default: inputs, buttons, tree rows, tabs bar items */
  --bd-control-lg: 32px;  /* dialog buttons, search in the insert panel header when touch-friendly */
  --bd-panel-header: 40px;
  --bd-statusbar-height: 28px;
  --bd-toolbar-height: 44px;

  --bd-border-width: 1px;

  --bd-elevation-1: 0 1px 2px var(--bd-shadow);                              /* sticky headers, page on the stage */
  --bd-elevation-2: 0 4px 12px var(--bd-shadow), 0 0 0 1px var(--bd-border); /* menus, popovers, tooltips, toasts */
  --bd-elevation-3: 0 12px 32px var(--bd-shadow), 0 0 0 1px var(--bd-border);/* dialogs, overlays on narrow screens */

  --bd-duration-fast: 100ms;   /* hover, press */
  --bd-duration-base: 160ms;   /* open/close, zoom, overlay slide */
  --bd-ease: cubic-bezier(0.2, 0, 0, 1);
}
@media (prefers-reduced-motion: reduce) {
  .buildr-editor { --bd-duration-fast: 0ms; --bd-duration-base: 0ms; }
}
```

Rules:

- Borders are 1px `--bd-border` for structure (panel dividers, cards) and 1px `--bd-border-strong` for interactive controls. Panels are separated by a 1px line, never by a heavy bar.
- Elevation is used **only** on floating layers (menus, popovers, tooltips, toasts, dialogs, the narrow-screen overlay) and the page on the stage. Panels themselves are flat.
- Panel body padding is `--bd-space-5` (16px) horizontally, `--bd-space-4` (12px) between field groups, `--bd-space-3` (8px) between label and control.
- Row height is `--bd-control-md` (28px) for tree rows, menu items and list-view entries; tiles are 68px high with `--bd-space-3` gaps.

### Focus ring

```css
.buildr-editor :focus-visible {
  outline: 2px solid var(--bd-focus);
  outline-offset: 1px;
}
.buildr-editor .bd-toolbar :focus-visible { outline-color: var(--bd-toolbar-focus); }
```

2px, offset 1px, `--bd-focus` (>= 3:1 against `surface`, `bg` and, in the toolbar, `--bd-toolbar-focus` against `--bd-toolbar`). Inside clipped containers (tree rows, tiles) use `outline-offset: -2px`. Never remove an outline without replacing it. Selection is not focus: selected rows use `surface-selected` plus a 2px `accent` left bar; focus is always the ring.

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
| text | `--bd-toolbar-text` #f0f1f4 | `--bd-toolbar` #1c1d22 | 14.90 | 4.5 | yes |
| text | `--bd-toolbar-text` #f0f1f4 | `--bd-toolbar-hover` #33363f | 10.68 | 4.5 | yes |
| text | `--bd-toolbar-muted` #b4b9c6 | `--bd-toolbar` #1c1d22 | 8.57 | 4.5 | yes |
| text | `--bd-toolbar-muted` #b4b9c6 | `--bd-toolbar-hover` #33363f | 6.15 | 4.5 | yes |
| boundary | `--bd-border-strong` #7d8391 | `--bd-surface` #ffffff | 3.80 | 3 | yes |
| boundary | `--bd-border-strong` #7d8391 | `--bd-surface-2` #f4f5f8 | 3.49 | 3 | yes |
| boundary | `--bd-border-strong` #7d8391 | `--bd-bg` #e9ebf0 | 3.19 | 3 | yes |
| boundary | `--bd-focus` #3f5ae0 | `--bd-surface` #ffffff | 5.60 | 3 | yes |
| boundary | `--bd-focus` #3f5ae0 | `--bd-bg` #e9ebf0 | 4.69 | 3 | yes |
| boundary | `--bd-toolbar-focus` #a3b3f4 | `--bd-toolbar` #1c1d22 | 8.26 | 3 | yes |
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
| text | `--bd-primary-text` #ffffff | `--bd-primary` #3f5ae0 | 5.60 | 4.5 | yes |
| text | `--bd-primary-text` #ffffff | `--bd-primary-hover` #3049bd | 7.46 | 4.5 | yes |
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
| boundary | `--bd-primary` #3f5ae0 | `--bd-surface` #1c1d22 | 3.00 | 3 | yes |
| boundary | `--bd-primary` #3f5ae0 | `--bd-bg` #121317 | 3.32 | 3 | yes |


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
2. **Primary button colour is the same in both themes** (`#3f5ae0` with white text, 5.6:1), while `accent` (text/icons) is lighter in dark. Alternative: a lighter primary in dark with dark text.
3. **The toolbar is dark in both themes**, and darker than the panels in the dark theme (`#0c0d10` vs `#1c1d22`).
4. **Cool-tinted neutrals** instead of pure greys.
5. **`border` is decorative and low contrast**; only `border-strong` (`#7d8391`, a fairly visible grey) meets 3:1. Alternative: one border colour at 3:1 everywhere (heavier look).
6. **Spacing scale starts at 2px** (2/4/6/8/12/16/20/24/32), as in the card; the 6px step is used sparingly.
7. **Dialog radius 8px, control radius 6px** (upper end of V4's 4-6px range for controls).
8. **Info is teal**, so it is never the accent blue.
9. **Focus ring** is 2px with 1px offset rather than a box-shadow ring, so it also works with forced-colours mode.

## Appendix A: contrast script

Run with `node contrast.mjs` (two files, ESM, no dependencies). `tokens.mjs` holds the theme objects that section 3 was generated from; `contrast.mjs` prints the tables of section 8 and reports the number of failing rows on stderr.

`tokens.mjs`

```js
export const accent = {50:'#f1f4fe',100:'#e2e8fc',200:'#c7d2f9',300:'#a3b3f4',400:'#7a90ee',500:'#5570e8',600:'#3f5ae0',700:'#3049bd',800:'#293c94',900:'#22326f'};
export const neutral = {0:'#ffffff',50:'#f7f8fa',100:'#f0f1f4',150:'#e8eaef',200:'#dfe1e7',300:'#c8ccd5',400:'#a3a8b5',500:'#7d8391',600:'#636a7b',700:'#4b5060',800:'#33363f',850:'#26282f',900:'#1c1d22',950:'#121317'};
export const light = {
 bg:'#e9ebf0', surface:'#ffffff', 'surface-2':'#f4f5f8', 'surface-hover':'#eceef2', 'surface-selected':'#e2e8fc',
 border:'#dfe1e7', 'border-strong':'#7d8391',
 text:'#1c1d22', 'text-muted':'#4b5060', 'text-subtle':'#5c6373',
 accent:'#3f5ae0', 'accent-hover':'#3049bd', 'accent-soft':'#e2e8fc', 'accent-text':'#ffffff', focus:'#3f5ae0',
 danger:'#c0282d','danger-soft':'#fdecec', warning:'#8a5300','warning-soft':'#fff3d9', success:'#1b7a3d','success-soft':'#e4f5ea', info:'#0b6b80','info-soft':'#e0f3f7',
 toolbar:'#1c1d22','toolbar-hover':'#33363f','toolbar-border':'#33363f',
 'toolbar-text':'#f0f1f4','toolbar-muted':'#b4b9c6','toolbar-focus':'#a3b3f4',
 shadow:'rgb(18 19 23 / 14%)'
};
export const dark = {
 bg:'#121317', surface:'#1c1d22', 'surface-2':'#23252b', 'surface-hover':'#2b2d35', 'surface-selected':'#243268',
 border:'#33363f', 'border-strong':'#7d8391',
 text:'#ecedf1', 'text-muted':'#b0b5c2', 'text-subtle':'#9fa5b4',
 accent:'#8ea2f5', 'accent-hover':'#a3b3f4', 'accent-soft':'#25325f', 'accent-text':'#0f1636', focus:'#a3b3f4',
 danger:'#ff8a8a','danger-soft':'#3d2226', warning:'#f2b552','warning-soft':'#3a2e15', success:'#5fce85','success-soft':'#173325', info:'#5fc9dc','info-soft':'#143038',
 toolbar:'#0c0d10','toolbar-hover':'#26282f','toolbar-border':'#26282f',
 'toolbar-text':'#ecedf1','toolbar-muted':'#a9aebb','toolbar-focus':'#a3b3f4',
 shadow:'rgb(0 0 0 / 55%)'
};
// primary button fill (both themes): accent-600 with white, dark uses a dedicated pair
light['primary']='#3f5ae0'; light['primary-text']='#ffffff';
light['primary-hover']='#3049bd'; dark['primary-hover']='#3049bd'; dark['primary']='#3f5ae0'; dark['primary-text']='#ffffff';

```

`contrast.mjs`

```js
import {light,dark} from './tokens.mjs';
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
export const cr=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)};
const T=4.5,B=3;
export function pairs(t){
 const P=[]; const add=(kind,fg,bg,min)=>P.push({kind,fg,bg,min,ratio:cr(t[fg],t[bg])});
 for(const f of ['text','text-muted','text-subtle'])for(const b of ['surface','surface-2','bg','surface-hover','surface-selected'])add('text',f,b,T);
 add('text','text','accent-soft',T);
 add('text','primary-text','primary',T); add('text','primary-text','primary-hover',T);
 add('text','accent','surface',T);add('text','accent','surface-2',T);add('text','accent','accent-soft',T);add('text','accent','surface-selected',T);
 add('text','accent-text','accent',T);
 for(const s of ['danger','warning','success','info']){add('text',s,'surface',T);add('text',s,s+'-soft',T);}
 for(const f of ['toolbar-text','toolbar-muted'])for(const b of ['toolbar','toolbar-hover'])add('text',f,b,T);
 for(const b of ['surface','surface-2','bg'])add('boundary','border-strong',b,B);
 for(const b of ['surface','bg'])add('boundary','focus',b,B);
 add('boundary','toolbar-focus','toolbar',B);
 add('boundary','accent','surface',B);add('boundary','accent','bg',B);
 add('boundary','primary','surface',B);add('boundary','primary','bg',B);
 return P;
}
if(process.argv[1].endsWith('contrast.mjs')){
 let bad=0;
 for(const [n,t] of [['light',light],['dark',dark]]){console.log(`\n### ${n}\n\n| Kind | Foreground | Background | Ratio | Min | Pass |\n|---|---|---|---|---|---|`);
  for(const p of pairs(t)){const ok=p.ratio>=p.min;if(!ok)bad++;console.log(`| ${p.kind} | \`--bd-${p.fg}\` ${t[p.fg]} | \`--bd-${p.bg}\` ${t[p.bg]} | ${p.ratio.toFixed(2)} | ${p.min} | ${ok?'yes':'**NO**'} |`)}}
 console.error('failures',bad);
}

```
