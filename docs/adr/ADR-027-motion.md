# ADR-027: Motion

**Status:** Accepted (2026-11-06)

## Context

Authors need entrance, hover and scroll effects without adding browser scripts to the shared renderer or making content inaccessible when animation is unavailable.

## Options

1. **Runtime JavaScript with IntersectionObserver** — rejected: adds client runtime, hydration and lifecycle cost and weakens ADR-008's shared server-compatible renderer. A future opt-in may revisit it.
2. **Free-form animation CSS** — rejected: cannot provide the typed, deterministic style grammar.
3. **Typed motion compiled to CSS** — supports progressive enhancement without renderer JavaScript.

## Decision

Add a `motion` style group to core `NodeStyles`: entrance effect, direction, duration, delay and easing curve; hover animation; and scroll-linked reveal and parallax. Values use enums and bounded numbers, never free strings. Compile deterministically to `@keyframes` and transitions for entrance and hover, and scroll-driven `animation-timeline: view()` / `scroll()` for reveal and parallax. No client runtime script or renderer JavaScript is introduced, preserving ADR-008's shared server-compatible rendering invariant.

Scroll motion is progressive enhancement: the base state is visible, static content, and supported animation rules are applied only when supported. `prefers-reduced-motion` disables all motion and restores that static state. As of 2026-11-05, [MDN browser compatibility data](https://github.com/mdn/browser-compat-data/blob/main/css/properties/animation-timeline.json) reports Firefox 159 supports both `view()` and `scroll()`; earlier unsupported versions show static content.

## Consequences

- Unsupported browsers retain readable content but do not reproduce scroll effects. Feature queries and tests must verify the fallback and reduced-motion state.
- Bounded parameters and deterministic compilation limit injection and make output testable. Motion may still distract users; reduced-motion support and conservative defaults mitigate this.
- The new document style shape must follow ADR-014 migration and fixture requirements.
