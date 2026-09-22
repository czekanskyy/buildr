# ADR-007: Responsive model

**Status:** Accepted

## Context

Responsive behavior (columns, direction, gaps, visibility) must not require separate per-device components, and must map cleanly onto real CSS media queries so the canvas iframe (which is literally resized to the breakpoint width) reflects production behavior with no special-casing.

## Options

1. **Mobile-first** (`base` = smallest screen, breakpoints widen upward) — the common web-authoring convention, but mismatched to how visual builder users typically work (Webflow, Elementor: design desktop first, then adjust down).
2. **Desktop-first** (`base` = no media query = desktop; overrides cascade downward through `tablet` → `mobile` via `max-width` queries).
3. **Per-device components** — rejected: multiplies the catalog and breaks the "one document, one structure" model.

## Decision

**Desktop-first.** `styles.base` has no media query; `styles.bp.tablet` and `styles.bp.mobile` are `max-width` overrides that cascade downward. Breakpoints are configurable in the theme (stable `id`, strictly decreasing `maxWidth`), so adding a breakpoint needs no document migration; removing one does. Responsive parameters that change layout (columns, direction, gap, visibility) are **styles**, not props — this keeps responsiveness working with zero JavaScript and with no separate components.

## Consequences

- Matches the mental model of most visual-builder users and of the canvas, whose iframe width literally *is* the active breakpoint.
- CSS output uses standard `max-width` media queries; adding container queries later (v0.3, via a separate `cq` layer) is additive, not a breaking change.
- One exception, deferred to v0.2: custom components may declare a `responsive` prop mapped to a per-breakpoint CSS custom property, for cases a style group can't express.
