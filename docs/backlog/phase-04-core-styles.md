# Phase 4: Core, styles

## PB-027 - The style model, property registry, grammars - L

- **Purpose**: a safe, typed style model (see `docs/styles.md`).
- **Dependencies**: PB-006
- **Files**: `packages/core/src/styles/{model,properties,grammar,schema}.ts`
- **Implementation**: `StyleDecl`, the property registry, parsers (token, length, color, enum), `nodeStylesSchema`; a narrowed `PageNode.styles` type.
- **Tests**: every grammar; an injection-attempt corpus (`red;}body{`, `url(`, `expression(`, backslash); a property-based test asserting an accepted value never contains a forbidden character.
- **Acceptance criteria**: every property in `docs/styles.md` has a registry entry and a test.
- **Risks**: missing properties — added over time via the process documented under `docs/ai/`.

## PB-028 - Theme and tokens - M

- **Purpose**: design tokens as CSS variables (see `docs/styles.md`).
- **Dependencies**: PB-027
- **Files**: `packages/core/src/styles/{theme,tokens}.ts`
- **Implementation**: `defineTheme` (validation, strictly decreasing breakpoints, token naming rules), `compileTokens` (emits `@layer buildr.tokens`), `resolveTokenRef`, `LAYER_ORDER_CSS`.
- **Tests**: CSS snapshots; invalid themes.
- **Acceptance criteria**: deterministic output.
- **Risks**: none.

## PB-029 - The CSS compiler - L

- **Purpose**: node styles to CSS (see `docs/styles.md`, `docs/responsive.md`).
- **Dependencies**: PB-028, PB-008
- **Files**: `packages/core/src/styles/{compile,compile-node,cache}.ts`
- **Implementation**: `compileStyles(doc, theme) -> { css, hash }`, the `.b-<id>` class, per-breakpoint media blocks, compound-property mapping (`columns`, `Box`, `hidden`), a per-node cache (`WeakMap`), `compileNodeRules` for the canvas.
- **Tests**: fixture snapshots; determinism; a 1000-node benchmark under 10ms; the output is parseable CSS (verified with `css-tree` in the test).
- **Acceptance criteria**: no `!important` and no value outside the grammar ever appears in output.
- **Risks**: CSS payload size — guarded by a test budget.

## PB-030 - Effective styles for the inspector - S

- **Purpose**: a value and its source per breakpoint.
- **Dependencies**: PB-027
- **Files**: `packages/core/src/styles/effective.ts`
- **Implementation**: `effectiveStyle(node, bp) -> { value, source }` per property; `hasOverrides(node, bp)`.
- **Tests**: the desktop -> tablet -> mobile cascade, reset behavior.
- **Acceptance criteria**: the API is ready for the inspector and the layers panel.
- **Risks**: none.
