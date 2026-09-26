# Responsive design

See also [ADR-007](adr/ADR-007-responsive-model.md) and [styles.md](styles.md).

- **Desktop-first model**: `base` is desktop, with no media query. Overrides cascade downward: `tablet` (<= 1023px), then `mobile` (<= 767px). The effective value on mobile is `merge(base, tablet, mobile)`. This matches how visual-builder users typically work (design desktop first, then adjust down), and it matches the canvas, whose iframe literally starts at desktop width.
- **Breakpoints are configurable** in the theme (a stable `id`, decreasing `maxWidth`). Adding a breakpoint needs no document migration. Removing one requires a migration that merges its overrides into a neighboring breakpoint.
- **Serialization**: `styles.base` plus `styles.bp.<id>`, always storing full style groups (see the example in [document-model.md](document-model.md)).
- **Generated CSS**:

```css
@layer buildr.nodes {
  .b-Gx81kLm2Pq { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--b-space-8); }
  @media (max-width: 1023.98px) { .b-Gx81kLm2Pq { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 767.98px)  { .b-Gx81kLm2Pq { grid-template-columns: minmax(0, 1fr); } }
}
```

- **Layout parameters that change per breakpoint (columns, direction, gap, visibility) are styles, not props.** This is what makes responsiveness work with zero JavaScript and with no separate per-device components. Props themselves are never responsive. The one exception, added in v0.2, is a custom component declaring a `responsive` prop that compiles to a per-breakpoint CSS custom property, for cases a style group cannot express.
- **Container queries (v0.3)**: `styles.cq: [{ container?: 'card', minWidth?: 400, maxWidth?: ..., style: StyleDecl }]` compiles to `@container card (min-width: 400px) { ... }`. Section/Container components gain a `containerName` prop. Cascade order becomes `base -> bp -> cq`.
- **Editor behavior**: switching breakpoints resizes the canvas **iframe** itself (desktop: the panel's own width, minimum 1280px; tablet 768px; mobile 375px), so real media queries fire natively — no simulation. The inspector writes to the active layer, shows a value's source ("from Desktop"), and offers "Reset to Desktop" to remove an override. The layers panel marks nodes that have overrides at the current breakpoint.

## Effective styles (for the inspector and layers panel)

`effectiveStyles(styles, bp, theme.breakpoints)` (`@next-buildr/core/styles`) returns, per property path (`layout.gap`, `spacing.margin.top`, `border.radius.topLeft`), `{ value, source }`: the value after `merge(base, …, bp)` and the layer that set it (`'base'` or a breakpoint id). A property nobody sets has no entry; resetting a key at a breakpoint makes it fall back to the widest layer that still sets it. `effectiveStyle(styles, bp, breakpoints, path)` looks up one path; `hasOverrides(styles, layer)` says whether a node sets anything at exactly that layer. An unknown breakpoint id sees only `base`. Values are the stored ones (tokens stay `$space.4`); ancestor inheritance is not included (v0.2).
