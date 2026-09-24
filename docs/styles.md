# Styles

See also [ADR-006](adr/ADR-006-styling-model.md) and [responsive.md](responsive.md).

## Model

```ts
export interface NodeStyles {
  base?: StyleDecl;                                        // desktop (no media query)
  bp?: Partial<Record<BreakpointId, StyleDecl>>;           // 'tablet' | 'mobile' (configurable)
  state?: Partial<Record<'hover' | 'focus-visible' | 'active', StyleDecl>>;   // v0.2
  cq?: ContainerOverride[];                                // v0.3, container queries
}

export interface StyleDecl {
  layout?:     { display?; direction?; wrap?; justify?; align?; alignSelf?; gap?; rowGap?; columnGap?;
                 columns?; rows?; columnSpan?; order?; position?; inset?: Box; zIndex?; overflow? };
  size?:       { width?; minWidth?; maxWidth?; height?; minHeight?; maxHeight?; aspectRatio? };
  spacing?:    { margin?: Box; padding?: Box };
  typography?: { fontFamily?; fontSize?; fontWeight?; lineHeight?; letterSpacing?; textAlign?;
                 textTransform?; fontStyle?; textDecoration?; color? };
  background?: { color?; gradient?; imagePosition?; imageSize? };  // the background image itself is a component prop (a bindable MediaRef)
  border?:     { width?: Box; style?; color?; radius?: Corners };
  effects?:    { opacity?; shadow?; transition?; cursor? };
  visibility?: { hidden?: boolean };                               // display: none per breakpoint
}
type Box = { top?: StyleValue; right?: StyleValue; bottom?: StyleValue; left?: StyleValue };
```

## Value grammar (per property, never free-form CSS)

- **Token**: `"$space.4"`, `"$color.primary"`, `"$radius.md"` compiles to `var(--b-space-4)`.
- **Length**: a number plus an allowlisted unit (`px rem em % vw vh svh dvh ch fr`), and, per property, allowlisted keywords (`auto`, `none`, `inherit` — the last only for properties that are naturally inheritable).
- **Color**: a token, or strictly parsed `#rgb[a]`, `#rrggbb[aa]`, `rgb()`, `hsl()`, `oklch()`.
- **Enums**: per property (`display: 'flex' | 'grid' | 'block' | 'inline-flex' | 'none'`, etc.).
- **Forbidden everywhere**: `url()`, `var()`, `calc()` (a restricted `calc()` ships in v1.0), `expression()`, `!important`, semicolons and curly braces. This is what makes CSS injection impossible.

**Representation.** A `StyleValue` is a string or a number. Lengths are strings with a unit (`"16px"`, `"1.5rem"`; the bare `0`/`"0"` is allowed), unitless properties take numbers (`opacity: 0.5`, `zIndex: 10`, `columns: 3`), keywords are exact lowercase strings, and tokens are `$scale.name` (scales: `color space radius shadow fontFamily fontSize fontWeight lineHeight container transition`; a property accepts only the scales its grammar lists). Box properties (`margin`, `padding`, `inset`, `border.width`) are per-side objects and `border.radius` is per-corner (`topLeft topRight bottomRight bottomLeft`). Whether a token exists in the theme is checked against the theme, not by the grammar.

`parseStyleValue(grammar, input, { inheritable })` returns the CSS text to emit, never the input itself: a value is rejected or re-rendered from its parsed parts (`"007px"` becomes `7px`, `#FFF` becomes `#fff`, `rgb(1, 2, 3)` becomes `rgb(1 2 3)`, `$space.4` becomes `var(--b-space-4)`). Before any grammar runs, a string containing `; { }  < > " ' ` @`, control characters, `url(`, `var(`, `calc(`, `expression(`, `image-set(`, `attr(`, `env(`, `!important`, comments or `javascript:` is rejected, and values are limited to 200 characters. Colors accept `#rgb[a]`, `#rrggbb[aa]`, `rgb()`, `hsl()`, `oklch()` with strictly parsed components (named colors are not accepted); gradients accept only `linear-gradient(<angle|to side>, <color> [<n>%], ...)` with 2 to 8 stops; `columns`/`rows`/`columnSpan` take a whole number 1 to 12. `visibility.hidden` compiles to `display: none` when `true` and to nothing when `false`.

`nodeStylesSchema` validates `PageNode.styles` (`base`, `bp` with at most 8 breakpoint ids, `state` restricted to properties with `allowInStates`) with unknown keys rejected. Pseudo-state (`state`) overrides are accepted by the schema but compiled only from v0.2; `cq` is not part of the MVP schema.

The **property registry** (`core/styles/properties.ts`) describes every property: `{ group, cssProperty, grammar, inheritable, tokenScale?, allowInStates }`. Both the compiler and the validator read from this single registry, so an unrecognized property is a validation error by construction.

## Theme and tokens

```ts
export const defaultTheme = defineTheme({
  breakpoints: [{ id: 'tablet', maxWidth: 1023 }, { id: 'mobile', maxWidth: 767 }],  // base = desktop
  tokens: {
    color: { primary, 'on-primary', surface, 'surface-alt', text, 'text-muted', border, focus, danger, success },
    space: { 0: '0', 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 6: '1.5rem', 8: '2rem', 12: '3rem', 16: '4rem', 24: '6rem' },
    radius: { none, sm, md, lg, full }, shadow: { sm, md, lg },
    fontFamily: { body, heading, mono }, fontSize: { xs, sm, md, lg, xl, '2xl', '3xl', '4xl', '5xl' },
    fontWeight: { regular, medium, semibold, bold }, lineHeight: { tight, normal, relaxed },
    container: { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem' }, transition: { fast, normal },
  },
});
```

Tokens are emitted as `@layer buildr.tokens { :root { --b-color-primary: ...; --b-space-4: ...; } }`. In MVP the theme comes from code (trusted); from v0.2, token overrides stored in a Payload global go through the exact same grammar validation (untrusted).

## CSS strategy

- **Layer order** (declared once): `@layer buildr.reset, buildr.tokens, buildr.components, buildr.nodes;`
- **Component CSS**: static files shipped as `@buildr/components/styles.css`, in `@layer buildr.components`. Classes are `.bc-<name>` with variant modifiers, built on tokens — this is the design system.
- **Node CSS**: a `.b-<nodeId>` class in `@layer buildr.nodes` (wins over the component layer through layer ordering, not specificity). Emission order: document pre-order; all `base` rules first, then `state` (v0.2), then one `@media` block per breakpoint gathering every node's overrides.
- **Determinism**: the same document plus the same theme always produce the identical CSS string, which is what makes snapshot testing and a content-addressed cache (`hash(styles + theme)`) possible.
- **Delivery**: in RSC, `<style href={"buildr-" + hash} precedence="buildr">` (React 19 hoists this into `<head>` and deduplicates automatically). In the canvas, a single `<style id="buildr-nodes">` with a per-node rule cache (a `WeakMap` keyed on `node.styles` identity).
- **Interaction with page-level CSS**: unlayered styles always beat layered ones — so a site's own global CSS (e.g. Tailwind v4, which uses `@layer` itself) should either live in a layer or be declared before `buildr.*`.
- **Inheritance**: ordinary CSS inheritance handles typography naturally. The inspector shows whether a value is set on the current node, at the current breakpoint, or inherited from a wider one. Showing values inherited from an ancestor node (computed) is a v0.2 addition.
- **Reset/inherit**: "Reset" removes the key (falling back to the component's own CSS or to inheritance). `inherit` is only valid for properties that are naturally inheritable. `!important` is never emitted.
- **Pseudo-states (v0.2)**: `state.hover|focus-visible|active` compiles to `.b-x:hover` etc., restricted to visual groups (color, background, border, effects). Removing the `focus-visible` outline is not representable in the model — by design.
- **Rejected alternatives**: atomic CSS (good deduplication, but hard to debug and awkward for responsive/pseudo-state ordering), inline styles (no media queries or pseudo-states), runtime CSS-in-JS (incompatible with RSC, adds client runtime cost).
