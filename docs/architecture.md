# Architecture overview

Buildr is a Visual Page Builder for React/Next.js with a first-class Payload CMS integration. This document is the map; each linked page goes deeper.

## The core rule

**`@buildr/core` depends on neither React, Next.js, nor Payload.** Dependencies only ever point downward:

```
core
 ├─▶ react ──▶ components
 └─▶ editor

core + react ──▶ next
core (+ next) ──▶ payload
```

`packages/editor` depends only on `core` — never on `react` or `components` — because the editor never renders the document itself; it drives a canvas (a real Next.js route, running the real renderer) through a `postMessage` protocol. See [`editor.md`](editor.md) and [ADR-015](adr/ADR-015-iframe-preview.md).

## The intended workflow

Payload CMS owns business data and workflow — title, slug, excerpt, SEO, status, author, media, drafts, versions, publishing. It does **not** own the visual editor. The flow is:

1. An editor works in Payload Admin as usual, filling in `title`, `slug`, `excerpt`, SEO fields, etc.
2. They click **"Edit with Visual Builder"**, which opens a separate browser tab/window.
3. The Visual Builder fetches the document through the Payload API (`@buildr/payload`'s HTTP contract).
4. The user edits the page layout visually.
5. The builder saves an AST/JSON document back to Payload (`layout` field).
6. Preview uses the **exact same renderer** as the production site.
7. Publishing is a Payload workflow action (draft → published), not a builder-specific concept.

The builder is never a full-screen field embedded inside Payload's admin dashboard. See [ADR-009](adr/ADR-009-editor-architecture.md) and [ADR-019](adr/ADR-019-deployment-topology.md).

## Packages

| Package | Depends on | Role |
|---|---|---|
| `@buildr/core` | zod, immer (commands only) | Document model, registry metadata, values/bindings, expressions, styles→CSS, commands, history, migrations, validation, accessibility, drag-and-drop rules, canvas protocol |
| `@buildr/react` | core, react | `renderTree`, server/client/canvas entry points, component authoring API |
| `@buildr/components` | core, react | Standard components, templates (composites), default theme |
| `@buildr/editor` | core, react (peer, deps), zustand, radix, lexical | The standalone visual editor application |
| `@buildr/next` | core, react, next | `BuildrPage`, platform bindings, draft mode, canvas/editor routes, metadata, cache tags |
| `@buildr/payload` | core, payload, (`@buildr/next` in the `next` subpath) | Plugin, endpoints, data source, HTTP adapter, admin UI |

Full package layout, subpath exports and the dependency-cruiser-enforced boundary table are in [`ai/package-boundaries.md`](ai/package-boundaries.md).

## Deep dives

- [Core concepts](core-concepts.md) — document, node, slot, `Value`, registry, template, renderer, canvas
- [Document model](document-model.md) — the canonical AST
- [Component registry](component-registry.md)
- [Dynamic bindings](dynamic-bindings.md) and [Expressions](expressions.md)
- [Styles](styles.md) and [Responsive](responsive.md)
- [Localization](i18n.md)
- [Accessibility](accessibility.md)
- [Renderer](renderer.md)
- [Editor](editor.md), [Drag and drop](drag-and-drop.md), [State management](state-management.md), [Commands](commands.md)
- [Payload integration](payload.md)
- [Next.js integration](nextjs.md)
- [Migrations](migrations.md), [Security](security.md), [Performance](performance.md), [Testing](testing.md)
- [Roadmap and MVP scope](roadmap.md)
