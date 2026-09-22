# Phase 6: The React renderer

## PB-044 - `defineComponent` and the React registry - M

- **Purpose**: the component-author API (see `docs/component-registry.md`, `docs/renderer.md`).
- **Dependencies**: PB-015, PB-017
- **Files**: `packages/react/src/define/{define-component,registry,types}.ts`
- **Implementation**: `defineComponent` (metadata + `render` + `runtime` + `migrations`), `createRegistry` (a metadata registry plus an implementation map plus migrations), `BuilderComponentProps<P>`, the `Platform` type.
- **Tests**: type tests (`expectTypeOf` against `ResolvedProps`), construction-time validation, `toManifest` from the React registry.
- **Acceptance criteria**: the React registry passes through to core without losing metadata.
- **Risks**: none.

## PB-045 - `renderTree` - L

- **Purpose**: one renderer for both production and the canvas (see ADR-008).
- **Dependencies**: PB-044, PB-025
- **Files**: `packages/react/src/render/{render-tree,render-node,root-attrs,instrument}.ts`
- **Implementation**: the tree walk, `resolveProps`, `visibleIf`, `root` attributes (`className: bc-* b-<id>`, `id`), recursive slot rendering, unknown-type handling (`null` or a placeholder via `instrument`), a dev-mode serializability guard for `runtime: 'client'`, extension points (`instrument`: a node wrapper, an empty-slot placeholder), diagnostic collection.
- **Tests**: SSR (`renderToStaticMarkup`) against fixtures: slots, bindings, fallbacks, unknown components, root attributes, no DOM wrappers.
- **Acceptance criteria**: the shared render path uses no hooks or context (a static check plus a render under the `react-server` condition).
- **Risks**: accidental hook usage — caught by the `react-server` condition test.

## PB-046 - Loop and scopes in the renderer - M

- **Purpose**: data lists (see `docs/renderer.md`).
- **Dependencies**: PB-045, PB-026
- **Files**: `packages/react/src/render/loop.ts`
- **Implementation**: `item`/`index`/`loop`/`as` scopes, `${id}:${i}` keys, `data-bi`, anchor suffixes, `item`/`empty`/`after` slots, a binding or query source (from `PreparedData`).
- **Tests**: an empty and a populated list, a nested Loop over a field, pagination in `after`.
- **Acceptance criteria**: instances share the same `.b-<id>` class.
- **Risks**: none.

## PB-047 - Style delivery and entry points - M

- **Purpose**: `./server` and `./client` (see `docs/architecture.md`, `docs/styles.md`).
- **Dependencies**: PB-045, PB-029, PB-026
- **Files**: `packages/react/src/{server,client}/*.tsx`, `render/styles.tsx`
- **Implementation**: `BuildrStyles` (`<style href precedence>` for tokens and node CSS, layer order declared once), `renderDocument` (the async pipeline: migrate -> prepare -> compile -> render), `DocumentRenderer` (`'use client'`, for SPA use, accepting either `PreparedData` or a `DataSource`).
- **Tests**: SSR of a full document, style deduplication, client-side rendering in jsdom.
- **Acceptance criteria**: `./server` never imports a `'use client'` module other than registry components themselves.
- **Risks**: none.

## PB-048 - The rich text renderer - M

- **Purpose**: safely rendering the Lexical subset (see `docs/renderer.md`).
- **Dependencies**: PB-044, PB-020
- **Files**: `packages/react/src/richtext/{render,converters}.tsx`
- **Implementation**: the walker, extensible `richTextConverters`, links routed through `platform.Link` with sanitization, text formatting bitmask, lists, headings.
- **Tests**: snapshots, malicious links, unknown node types.
- **Acceptance criteria**: no `dangerouslySetInnerHTML` anywhere.
- **Risks**: none.

## PB-049 - The playground app (Vite), the fixture gallery, an SSR harness - M

- **Purpose**: a development and visual-testing environment with no Next.js/Payload dependency.
- **Dependencies**: PB-047, PB-009
- **Files**: `apps/playground/**`, `packages/test-utils/src/render.ts`
- **Implementation**: Vite + React 19; a `/gallery?fixture=...&w=...` route rendering fixtures via `DocumentRenderer` plus `MemoryDataSource`; `renderFixtureToHtml` for snapshot tests.
- **Tests**: a Playwright smoke test (the gallery loads).
- **Acceptance criteria**: `pnpm dev` opens the gallery.
- **Risks**: none.
