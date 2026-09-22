# ADR-006: Styling model

**Status:** Accepted

## Context

Per-instance styling must be themeable, safe against CSS injection from untrusted JSON, and must not force every node into an inline-style/CSS-in-JS runtime cost — while still supporting a proper design system look-and-feel for shipped components.

## Options

1. **Free-form CSS blob per node** — rejected: no injection safety without a full CSS parser/sanitizer, no type safety, no design-token integration.
2. **Utility/atomic classes (Tailwind-style) generated per node** — good deduplication, but awkward responsive/pseudo-state ordering and harder to debug generated class soup for a visual editor's own tooling.
3. **Inline styles** — no media queries, no pseudo-states, ruled out immediately.
4. **Runtime CSS-in-JS** — incompatible with React Server Components and adds client runtime cost.
5. **Typed style groups + design tokens, compiled to a per-node class in a CSS `@layer`** — a `StyleDecl` grouped by concern (layout, size, spacing, typography, background, border, effects), values constrained by a **per-property grammar** (tokens, or numbers with an allowlisted unit, or a small enum — never a free string), compiled deterministically to `.b-<nodeId>` rules.

## Decision**

Adopt the typed-group + tokens + `@layer` model. Component *look* (the design system itself) lives in the component's own CSS, in `@layer buildr.components`; a node's `styles` field holds **only instance overrides**, compiled into `@layer buildr.nodes`, which — by layer ordering, not specificity wars — always wins.

## Consequences

- No CSS injection is possible: the grammar never accepts `url()`, `calc()`, `;`, `@`, or `!important`.
- Documents stay small (only overrides are stored, not full styles).
- Deterministic CSS output enables snapshot testing and content-addressed caching (`hash(styles + theme)`).
- Less raw expressive freedom than hand-written CSS — mitigated by style presets (v0.2) and a restricted `calc()` escape hatch (v1.0).
