# Editor design guidelines

Status: **first draft (PB-147).** PB-119 turns the token section into the reference tables and adds the layout grid and do/don't examples; PB-120 adds the icon rules. Sections marked *placeholder* are filled by those tasks. The source of truth for values is [design/identity.md](design/identity.md); mockups are in [design/mockups/](design/mockups/).

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

*Placeholder (PB-119):* generated tables of every token as shipped in `styles/tokens.css`, kept in sync by the contrast unit test.

## Layout grid

*Placeholder (PB-119, PB-122):* panel anatomy (40px header, scroll body with 16px side padding, optional sticky footer), splitters (1px line, 8px hit area), the 28px status bar, panel widths, and the narrow-screen overlay rule (below 1100px the canvas keeps at least 480px).

## Icons

*Placeholder (PB-120):* the `Icon` and `ComponentIcon` components, the curated map, sizes (16px in rows, 20px in tiles), colours per state, and the fallback icon. Until then see [identity.md section 7](design/identity.md#7-icons).

## Density rules

*Placeholder (PB-119):* the density target (full toolbar on one row at 1280px; a typical component's Content tab fits without scrolling), field layout rules (short controls in a two-column row, long ones stacked), and row heights.

## Do and don't

*Placeholder (PB-119):* short before/after examples. Starter rules until then:

- Do use `--bd-border-strong` for the boundary of anything the user can type into or toggle; do not use `--bd-border` there (it is decorative and fails 3:1).
- Do use `--bd-text-subtle` for hints and placeholders; do not go lighter.
- Do show selection with `--bd-surface-selected` and an accent bar; do not fill a row with the solid accent.
- Do keep one primary button per region; do not add a second saturated button next to it.
- Do use the notice/toast component (PB-129) for messages; do not add another `position: fixed` message box.

## Themes

Follows the system by default, with a light / dark / system switch remembered per user (V5, PB-123); a host that sets `data-theme` explicitly wins and the switch is hidden. `color-scheme` and scrollbar colours follow the theme (PB-119).
