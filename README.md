# Buildr

> An open-source Visual Page Builder for React and Next.js, with a first-class Payload CMS integration.

**Status: pre-alpha — design phase.** There is no product code yet. This repository currently contains the architecture blueprint, Architecture Decision Records and the implementation backlog that contributors and coding agents follow to build the system step by step.

## What Buildr is

- **A React/Next.js library** — a production renderer that turns a canonical JSON document (AST) into React Server Components.
- **A standalone visual editor** — a separate application (its own route, bundle and browser tab), not a screen embedded in a CMS admin panel.
- **A Payload CMS integration** — Payload stores documents and owns the workflow (drafts, autosave, versions, publishing, media, auth); the editor talks to it through a plugin and a documented HTTP contract.
- **Production-ready output** — the canvas and the live site use the same renderer and the same CSS, so what you edit is what ships.

## Core principles

- The core (`@buildr/core`) depends on neither React, Next.js nor Payload. Dependencies only point downward: `core → react → components`, `core → editor`, `core + react → next`, `core (+ next) → payload`.
- The document is a normalized JSON AST — never HTML or JSX — with schema versioning and forward-only migrations from day one.
- Every prop of every component can be static, bound to CMS data, or computed by a small, sandboxed expression language. There are no `Dynamic*` components.
- Styles are a typed model compiled to deterministic CSS with design tokens, cascade layers and desktop-first responsive overrides.
- One page structure serves all languages; translations live in the document, CMS data is fetched per locale.

## Planned packages

| Package | Purpose |
|---|---|
| `@buildr/core` | Document model, component registry metadata, values and bindings, expressions, styles → CSS, commands, history, migrations, validation, accessibility rules, drag-and-drop rules, canvas protocol |
| `@buildr/react` | Renderer (server, client, canvas runtime) and the component authoring API |
| `@buildr/components` | Standard components, templates (composites) and the default theme |
| `@buildr/editor` | The visual editor application (client-only) |
| `@buildr/next` | Next.js App Router integration: `BuildrPage`, draft mode, canvas/editor routes, metadata, caching |
| `@buildr/payload` | Payload plugin, data source, HTTP adapter for the editor, admin UI |

## Documentation

- [Architecture overview](docs/architecture.md) — start here
- [Core concepts](docs/core-concepts.md)
- [Roadmap and MVP scope](docs/roadmap.md)
- [Architecture Decision Records](docs/adr/README.md)
- [Implementation backlog](docs/backlog/README.md)
- [Guide for AI coding agents](AGENTS.md)

## Contributing

The project is built task by task from the [backlog](docs/backlog/README.md). Read [docs/contributing.md](docs/contributing.md) and [AGENTS.md](AGENTS.md) before opening a pull request.

## License

MIT (the `LICENSE` file is added in task PB-005). The name “Buildr” is subject to a trademark policy that will be published with the first release.
