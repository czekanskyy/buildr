# Component development guide

Step-by-step recipe for adding or changing a component in `@buildr/components`. Read [component-registry.md](../component-registry.md) first for the underlying model.

## Directory structure

```
packages/components/src/<name>/
  definition.ts       # ComponentMeta + defineComponent(...) — no 'use client'
  view.tsx             # the render function, for runtime: 'shared'
  view.client.tsx      # the render function, for runtime: 'client' (starts with 'use client')
  styles.css           # .bc-<name> rules, in @layer buildr.components, built on tokens
  fixtures.ts          # gallery fixtures (documents this component can be tested/screenshotted against)
  <name>.test.tsx      # unit + accessibility + keyboard tests
```

A generator exists (or will, once task PB-050 lands): `pnpm gen:component <name>` scaffolds this structure.

## Steps

1. Decide `runtime`: `'shared'` unless the component genuinely needs browser APIs, hooks or client-only state — most components should be `shared`.
2. Write `definition.ts`: full `ComponentMeta` (label, category, icon, `props` via the `p.*` DSL with labels and defaults, `slots` if it has children, `contentCategories`, `styles.groups`, `a11y`, `editor.inlineProp` if it supports inline text editing, `formField` if it participates in form schema derivation, `runtime`, `version: 1`).
3. Write the view. It must spread `root` onto the component's single root DOM element — no wrapper `div`. It must not use hooks/context/browser APIs if `runtime: 'shared'`.
4. Write `styles.css`: only design tokens, never hard-coded colors; a `:focus-visible` style for anything interactive; respect `prefers-reduced-motion`.
5. Add fixtures covering: default state, every prop-`kind` combination that's bindable (static + bound), and — for interactive components — every documented keyboard interaction.
6. Write tests: an SSR snapshot, a root-spread assertion, prop validation, accessibility (`vitest-axe` against the SSR output), keyboard behavior where applicable.
7. Add the component to `components.md`.
8. Add a changeset.

## Definition of Done (component)

- `definition.ts` has complete metadata as above.
- The view spreads `root` and has no DOM wrapper.
- `runtime: 'shared'` components use no hooks/context/browser APIs; `runtime: 'client'` components live in `*.client.tsx` and only receive serializable props.
- CSS lives in `@layer buildr.components`, uses only tokens, includes a focus-visible style and respects reduced motion.
- Tests: SSR snapshot, root spread, prop validation, bindings for every `bindable` prop, axe on SSR output, keyboard tests for interactive components.
- Fixtures exist in the gallery at all three breakpoints, with an approved visual baseline.
- `docs/components.md` is updated.
- A prop schema change bumps `version`, ships a migration, and a migration fixture.
- The component's manifest projection is fully serializable (no functions leak into `toManifest()` output).

## Definition of Done (composite / template)

- Built entirely from components already in the target registry.
- Passes `validateDocument` and `runA11y` with zero errors once instantiated.
- Has tablet/mobile overrides and looks correct at all three breakpoints (a visual screenshot review).
- Regions and locks (if any) are documented in the template's description.
- Has a thumbnail.
- A test confirms instantiation produces fresh node IDs and a correct `source` marker.
- `docs/templates.md` (or `docs/components.md`) is updated.

See also [testing-rules.md](testing-rules.md) for the exact test types required per change, and [../accessibility.md](../accessibility.md) for the accessibility rules a new component must satisfy.
