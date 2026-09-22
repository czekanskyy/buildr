# Core concepts

A tour of the vocabulary used everywhere else in the documentation.

## Document

A `BuilderDocument` is the canonical, JSON-serializable representation of a page: a `schemaVersion`, a normalized map of `nodes`, and a `components` version map recording which prop-schema version each used component type was written against. See [`document-model.md`](document-model.md).

## Node

A `PageNode` is one element in the tree: an `id`, a `type` (a component type string like `buildr/heading`), `props` (each a `Value<T>`), `slots` (named lists of child node IDs), optional `styles`, and metadata (`name`, `anchor`, `lock`, `visibleIf`, `source`). Nodes reference each other only through `slots` — there is no stored `parent` pointer; parent/index/depth are derived on demand into a memoized `DocumentIndex`.

## Slot

A named place inside a node where children live. `default` is the conventional slot for "regular children"; components can declare additional named slots (Card: `media` / `body` / `actions`; Loop: `item` / `empty` / `after`). Slots replace the idea of a special `<Slot>` component — see [`component-registry.md`](component-registry.md) and [`templates.md`](templates.md).

## Value\<T\>

Every bindable prop's value is one of `StaticValue<T> | BindingValue<T> | ExpressionValue<T>`, discriminated by `kind`. There are no `Dynamic*` components — dynamism is a per-prop property, not a per-component one. See [`dynamic-bindings.md`](dynamic-bindings.md) and [ADR-004](adr/ADR-004-dynamic-binding.md).

## Component registry

A `ComponentMeta` (fully serializable: label, category, props schema, slots, content-model rules, style groups, accessibility metadata) is separated from its React implementation (`render`, `runtime`, `migrations`). `createRegistry()` builds an immutable registry; `toManifest()` projects it into JSON the editor can consume without ever importing component code. See [`component-registry.md`](component-registry.md).

## Template (composite)

A ready-made section (Hero, CTA, Pricing, …) is a `TemplateDefinition` whose `tree` is built entirely from ordinary registered components. Instantiating a template produces a normal, fully-editable subtree with fresh node IDs — not an opaque widget. See [`templates.md`](templates.md).

## Renderer

`renderTree` turns a document (after an async `prepareRender` data-fetching pass and a `compileStyles` CSS-generation pass) into React elements. The exact same function renders production pages (in `@buildr/next`'s `BuildrPage`, a Server Component) and the editor's canvas (instrumented with selection/hover/drag affordances). See [`renderer.md`](renderer.md).

## Canvas

The editor's live preview: a real Next.js route, loaded in an iframe, running the real renderer against a locally-synchronized replica of the document. The canvas never owns document state — the editor does — and the two communicate over a versioned `postMessage` protocol. See [`editor.md`](editor.md) and [ADR-015](adr/ADR-015-iframe-preview.md).

## Command

The only way to mutate a document. A serializable `{ type, payload }` object with a registered handler (`validate` + `apply`). `execute`/`executeBatch` are the sole entry points; undo/redo is built from the Immer patches they produce. See [`commands.md`](commands.md) and [ADR-013](adr/ADR-013-command-system.md).
