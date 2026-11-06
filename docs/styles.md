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
  background?: { color?; gradient?; imagePosition?; imageSize?; repeat?; attachment? };  // the background image itself is a component prop (a bindable MediaRef)
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

`parseStyleValue(grammar, input, { inheritable })` returns the CSS text to emit, never the input itself: a value is rejected or re-rendered from its parsed parts (`"007px"` becomes `7px`, `#FFF` becomes `#fff`, `rgb(1, 2, 3)` becomes `rgb(1 2 3)`, `$space.4` becomes `var(--b-space-4)`). Before any grammar runs, a string containing `; { }  < > " ' ` @`, control characters, `url(`, `var(`, `calc(`, `expression(`, `image-set(`, `attr(`, `env(`, `!important`, comments or `javascript:` is rejected, and values are limited to 200 characters. Colors accept `#rgb[a]`, `#rrggbb[aa]`, `rgb()`, `hsl()`, `oklch()` with strictly parsed components (named colors are not accepted); gradients accept `radial-gradient(<circle|ellipse> at <position>, <color> [<n>%], ...)` or `linear-gradient(<angle|to side>, <color> [<n>%], ...)` with 2 to 8 stops; `columns`/`rows`/`columnSpan` take a whole number 1 to 12. `visibility.hidden` compiles to `display: none` when `true` and to nothing when `false`.

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

`defineTheme(input)` validates and freezes a theme and throws with every problem listed (the theme is trusted code); `validateTheme(input)` returns a `Result` with path-tagged diagnostics for input you do not control. Rules: at most 8 breakpoints with ids like `tablet`, listed widest first with strictly decreasing whole-number `maxWidth` (240 to 4096); every token scale is optional; token names are lower-case letters and digits joined by single dashes (at most 32 characters, 64 tokens per scale); each token value goes through its scale's grammar and is stored normalized. A token value cannot refer to another token. Values: `color` (`#hex`, `rgb()`, `hsl()`, `oklch()`), `space`/`fontSize` (px, rem, em), `radius`/`container` (px, rem, em, %), `fontWeight` (100 to 900), `lineHeight` (a number or a length), `shadow` (up to 4 `[inset] <x> <y> [<blur> [<spread>]] <color>` layers or `none`), `fontFamily` (up to 8 unquoted family names or generic families), `transition` (`[property] <duration up to 5s> [timing] [delay]`, up to 4 layers).

`compileTokens(theme)` emits the string below deterministically (scales in a fixed order, tokens sorted by name), `resolveTokenRef(theme, '$space.4')` looks a reference up (`theme.unknown-token` when the theme does not define it — the style grammar only checks that a token is well formed and from an allowed scale), and `LAYER_ORDER_CSS` is the one-time layer declaration. A token compiles to the custom property `--b-<scale>-<name>` with the scale in kebab-case (`--b-font-family-body`).

Tokens are emitted as `@layer buildr.tokens { :root { --b-color-primary: ...; --b-space-4: ...; } }`. In MVP the theme comes from code (trusted); from v0.2, token overrides stored in a Payload global go through the exact same grammar validation (untrusted).

## CSS strategy

- **Layer order** (declared once): `@layer buildr.reset, buildr.tokens, buildr.components, buildr.nodes;`
- **Component CSS**: static files shipped as `@next-buildr/components/styles.css`, in `@layer buildr.components`. Classes are `.bc-<name>` with variant modifiers, built on tokens — this is the design system.
- **Node CSS**: a `.b-<nodeId>` class in `@layer buildr.nodes` (wins over the component layer through layer ordering, not specificity). Emission order: document pre-order; all `base` rules first, then `state` (v0.2), then one `@media` block per breakpoint gathering every node's overrides.
- **Determinism**: the same document plus the same theme always produce the identical CSS string, which is what makes snapshot testing and a content-addressed cache (`hash(styles + theme)`) possible.
- **Display prop and `layout.display`**: a component's own `display` prop (Container) sets the display through its component CSS in `@layer buildr.components`; a `layout.display` style on the node is in `@layer buildr.nodes` and wins, per breakpoint if wanted.
- **Delivery**: in RSC, `<style href={"buildr-" + hash} precedence="buildr">` (React 19 hoists this into `<head>` and deduplicates automatically). In the canvas, a single `<style id="buildr-nodes">` with a per-node rule cache (a `WeakMap` keyed on `node.styles` identity).
- **Interaction with page-level CSS**: unlayered styles always beat layered ones — so a site's own global CSS (e.g. Tailwind v4, which uses `@layer` itself) should either live in a layer or be declared before `buildr.*`.
- **Inheritance**: ordinary CSS inheritance handles typography naturally. The inspector shows whether a value is set on the current node, at the current breakpoint, or inherited from a wider one. Showing values inherited from an ancestor node (computed) is a v0.2 addition.
- **Reset/inherit**: "Reset" removes the key (falling back to the component's own CSS or to inheritance). `inherit` is only valid for properties that are naturally inheritable. `!important` is never emitted.
- **Pseudo-states (v0.2)**: `state.hover|focus-visible|active` compiles to `.b-x:hover` etc., restricted to visual groups (color, background, border, effects). Removing the `focus-visible` outline is not representable in the model — by design.
- **Rejected alternatives**: atomic CSS (good deduplication, but hard to debug and awkward for responsive/pseudo-state ordering), inline styles (no media queries or pseudo-states), runtime CSS-in-JS (incompatible with RSC, adds client runtime cost).

## The compiler (`compileStyles`)

`compileStyles(doc, theme, options?)` (`options.capabilities`, see Author code) → `{ css, hash, diagnostics }` (`@next-buildr/core/styles`). `css` is the layer order, the theme's tokens, then `@layer buildr.nodes { … }`; `hash` is the content hash of `css`.

- **Per node**: `compileNodeRules(id, styles, theme)` gives `{ base, state, bp, diagnostics }` with the `.b-<id>` selector — what the canvas uses to keep one `<style>` current node by node. `compileNodeDeclarations` is the same without selectors. Both are memoized on the identity of `styles` and `theme` (`WeakMap`, no shared state), and `compileStyles` is memoized per document, so an edit recompiles only the changed nodes.
- **Every value is re-parsed** through its property grammar before it is emitted; a value that fails is skipped and reported (`style.invalid-value`), so nothing outside the grammar and no `!important` can reach the output, whatever was validated earlier.
- **Compound properties**: `Box` and `Corners` become one longhand per side/corner (`margin-top`, `border-top-left-radius`, …); `layout.columns: n` becomes `grid-template-columns: repeat(n, minmax(0, 1fr))`; `visibility.hidden: true` becomes `display: none` (emitted after `layout.display`, so it wins) and `false` emits nothing. Declarations follow the property registry's order, not the order keys were written in.
- **Breakpoints** come from the theme: one `@media (max-width: <maxWidth + 0.98>px)` block per breakpoint, widest first (desktop-first cascade). A breakpoint id the theme does not define is skipped with `style.unknown-breakpoint`.
- **Diagnostics** (never thrown): `style.invalid-value`, `style.unknown-property`, `style.not-allowed-in-state`, `style.unknown-token` (warning: the variable is still emitted), `style.unknown-breakpoint`, `style.invalid-node-id` (an id outside `A-Z a-z 0-9 _ -` cannot be a class name and gets no rules). Node diagnostics carry `details.nodeId` and `details.property` (`base.layout.gap`, `bp.tablet.spacing.margin.left`).

## Motion (ADR-027)

The `motion` style group (base and breakpoints, never a pseudo-state) is typed, CSS-only and has no runtime script. Properties: `entrance` (`none`, `fade`, `slide`, `zoom`), `entranceDirection` (`up`, `down`, `left`, `right`), `entranceDuration` and `entranceDelay` (`ms`, up to 5000), `entranceEasing` (`ease`, `ease-in`, `ease-out`, `ease-in-out`, `linear`, `snappy`, `bounce`), `hover` (`none`, `lift`, `grow`, `shrink`, `tilt`) with `hoverDuration`, `scrollReveal` (`none`, `fade`, `slide`, `zoom`; slides up only) and `scrollParallax` (px, 0..200). Everything is an enum or a bounded number that goes back through its grammar before it is emitted.

It compiles inside `@layer buildr.nodes` to shared `@keyframes b-m-*` (only the `from` frame, so the finished state is the node's own style), a time-based entrance with `animation-fill-mode: backwards`, a `transition` plus a `(hover: hover)` rule for hover, and, behind `@supports (animation-timeline: view())`, `animation-timeline: view()` for reveal and parallax. All of it sits inside `@media (prefers-reduced-motion: no-preference)`, so a visitor who asks for less motion gets the static, visible node. A breakpoint can switch motion off (`entrance: none`). The hover transition replaces `effects.transition` on that node. `compileNodeRules` returns the same as `motion: { base, bp }` and `keyframes` (names; `keyframesRule(name)` gives each rule) for the canvas.

## Author code (ADR-026)

Off by default and decided by the host: `CommandEnv.capabilities.authorCode` must be exactly `true` (core fails closed when it is absent, `false` or anything else); `compileStyles(doc, theme, { capabilities })` and `authorNodeAttributes(node, capabilities)` take the same object. Without it the commands refuse (`command.author-code-not-permitted`; removing is always allowed), and a document that carries author code anyway renders without it and reports `author.not-permitted`. `checkAuthorCode(doc, capabilities, registry?)` is the guard for a host's write path.

- **`customCss`** (node field, `node.setAttr`, up to 8000 characters): parsed by a strict in-house reader, never emitted as written. Allowed: style rules (each selector is scoped under `.b-<id>`; a leading `&` is the node itself), `@media` and `@supports` around them, plain declarations and `!important`. Rejected: every other at-rule (`@import`, `@font-face`, `@keyframes`, `@property`, `@layer`, ...), `url()`, `image-set()`, `attr()`, `expression()`, backslash escapes, `<`, `javascript:` and `data:` URLs, `behavior`, `-moz-binding`, nested rules, sibling combinators (`+`, `~`), selectors that name Buildr classes, and limits on rules (100), declarations per rule (50) and value length. It is emitted into `@layer buildr.custom`, after `buildr.nodes`; a rejected part is dropped and reported (`author.css-rejected`), an applied one is noted (`author.css-applied`).
- **`classes`** (up to 16 tokens, no `b-` or `buildr` prefix) and **`attributes`** (up to 16: `data-*` but not `data-b*` (Buildr's own markers), `aria-*`, `role`, `title`, `lang`, `dir`, `tabindex`, values up to 256 characters without control characters; never `on*`, `style`, `class`, `id` or URL attributes): rendered on the node's root by the renderer.
- **Text `html`**: see `docs/components.md`. `p.textarea({ format: 'html' })` marks any prop as author HTML.

## Template style controls (PB-157)

All additions use existing `effects` / `background` groups and support base, breakpoint and
pseudo-state overrides. The styles public entry exports the augmented document interfaces,
`stylePropertyRegistry` (property ids and serializable grammars), `BLEND_MODES`,
`STYLE_POSITIONS`, `GRADIENT_TYPES`, `RADIAL_SHAPES`, `BACKGROUND_REPEATS` and
`BACKGROUND_ATTACHMENTS` for inspector controls. No dependency was added.

| Property ids | Grammar |
|---|---|
| `effects.shadowX`, `shadowY`, `shadowSpread`; `textShadowX`, `textShadowY` | px, -1000..1000 |
| `effects.shadowBlur`, `textShadowBlur` | px, 0..1000 |
| `effects.shadowColor`, `textShadowColor` | existing validated colour grammar, including `$color` tokens and alpha |
| `effects.shadowInset` | `inset` or `outset` (enum flag) |
| `effects.blur`, `backdropBlur` | px, 0..100 |
| `effects.brightness`, `contrast`, `saturate` | numbers 0..2 (1 = 100%) |
| `effects.grayscale`, `sepia`, `invert` | numbers 0..1 |
| `effects.hueRotate`, `rotate` | deg, -360..360 |
| `effects.translateX`, `translateY` | px, %, rem, -10000..10000 |
| `effects.scale` | number 0..10 |
| `effects.skewX`, `skewY` | deg, -89..89 |
| `effects.transformOrigin` | `STYLE_POSITIONS` |
| `effects.blendMode` | `BLEND_MODES` |
| `background.repeat`, `attachment` | `BACKGROUND_REPEATS`, `BACKGROUND_ATTACHMENTS` |

Zero lengths/angles also accept bare zero. Numeric precision follows the existing grammar
(up to four decimal places). Numbers with units must be strings; unitless values must be numbers.
Custom box shadow geometry compiles after the unchanged `effects.shadow` token preset, so it
wins within the same declaration. Missing geometry defaults to 0px, colour to #000, inset to
outset. Text shadow follows the same defaults without spread/inset. Colour alpha controls shadow
opacity. Removing all custom keys restores the preset.

Filters compile to one `filter` in order: blur, brightness, contrast, saturate, grayscale,
sepia, hue-rotate, invert. Backdrop blur produces `backdrop-filter: blur(...)`.
Transforms compile to one `transform`: translateX, translateY, rotate, scale, skewX, skewY.
Only set functions are emitted. A compound override at a breakpoint or state replaces that CSS
compound value; editors should write the full desired compound at that override, including
unchanged functions. This follows CSS shorthand replacement semantics.

`background.gradient` keeps its string representation: `linear-gradient(...)` selects linear;
`radial-gradient(circle at top left, #fff, $color.primary 100%)` selects radial. Radial shape is
`circle|ellipse`, position is `STYLE_POSITIONS`; omitted shape/position defaults to ellipse at
center. Both types accept 2..8 validated colour stops, optional 0..100% positions. Existing
linear normalization and output are byte-identical. No arbitrary gradient CSS is accepted.

ADR-014 requires migrations for document-shape / component-prop version changes. These are
optional values in existing style groups; existing documents and defaults are unchanged, like
other registry additions, so no schema version or migration is required.

Component follow-up (outside this change): page needs `effects` to show effect controls;
image, divider and icon need `background` to show background controls. No new group is needed.
