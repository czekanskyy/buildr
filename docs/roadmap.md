# Roadmap, release status and scope

## Release status

Buildr is released as **1.0.0**: every `@next-buildr/*` package is versioned together (a fixed changeset group) and published with npm provenance by the release workflow (see [releasing.md](releasing.md)). Phases 0-14 of the [backlog](backlog/README.md) are implemented: the MVP (phases 0-12), the editor visual polish (phase 13: design tokens, Inter, icons, the light/dark theme switch, narrow-screen panel overlays) and the MCP server for AI agents (phase 14, `@next-buildr/mcp`). Not everything once planned for 1.0 is done; see [Known gaps](#known-gaps--not-in-100) below, which is the authoritative list.

> **Version labels in other documents.** Feature documents still say "v0.2", "v0.3" or "v1.0" next to things that are deferred. Those labels are historical planning buckets, not release numbers: read them as "planned, not in 1.0.0" unless the item is listed as done below. There were no 0.x releases on npm; 1.0.0 is the first published version.

## Scenarios the MVP covers end to end

| # | Scenario | Built from |
|---|---|---|
| 1 | A simple landing page | Section, Container, Stack, Grid, Heading, Text, Button, Image, Icon, Card, Accordion, plus the Hero, FeatureGrid, Testimonial, Pricing, FAQ, CTA templates |
| 2 | A company/marketing page | Plus RichText, List, Divider, Badge, a Card grid, Contact |
| 3 | A blog post | The `posts` collection template: PostHeader (Heading bound to `post.title`, a formatted date, Image bound to `post.featuredImage`), AuthorBox (bound to `post.author`), PostContent (RichText bound to `post.content`) |
| 4 | A post listing | A "blog" page: Loop (`query posts`, `page` bound to `route.params.page`) plus PostCard plus Pagination (bound to `loop.page`/`loop.totalPages`) |
| 5 | A simple product page | The `products` collection template: ProductHero (a Loop over `product.images`, a heading, a formatted price, a Button linking to `product.buyUrl`), ProductDetails (RichText bound to `product.description`, an attribute list) |
| 6 | A page with a form | The Contact template: Form plus Input (name, email), Textarea, Checkbox (consent), a submit Button posting to `buildr-form-submissions` |
| 7 | Localization (cross-cutting) | Scenarios 1-6 in the example application in `pl` (default) and `en`: translation in the editor, CMS data fetched per locale, `/{locale}/...` routes, hreflang |

## Exit criteria and where they stand at 1.0.0

| Criterion | Status |
|---|---|
| Six scenarios plus localization, end to end, both locales, in-editor translation | Met: `apps/example-next-payload/e2e` (CI job `E2E`) |
| The same scenarios built by an agent through MCP | Met by a scripted MCP client without a model: `apps/example-next-payload/e2e/mcp`, run in CI with `BUILDR_MCP=1`. Real-model quality (`packages/mcp/evals`) is a manual/nightly harness only, never asserted |
| Performance budgets on a 1000-node fixture | **Not measured.** The budgets in [performance.md](performance.md) are design targets; there is no benchmark and no CI gate |
| Seed content without accessibility errors | Met: `documents.test.ts` (static validator) and axe in the e2e suite; axe also runs on every editor baseline state (`apps/playground/e2e/editor-a11y.spec.ts`) |
| Getting-started in under 15 minutes | The steps in [getting-started.md](getting-started.md) take about 5 minutes; a fresh-machine run by an outside person has not been done |
| Published to npm with provenance | Done by the release workflow when the Version PR is merged (needs the `NPM_TOKEN` secret); see [releasing.md](releasing.md) |

See [core-concepts.md](core-concepts.md), [components.md](components.md) and [templates.md](templates.md) for what the scenarios are built from.

## What shipped, by former "version" bucket

| Bucket | Done in 1.0.0 |
|---|---|
| MVP | Everything in the scenarios above: core (document, registry, values, expressions, styles, commands, validation, accessibility, drag-and-drop, protocol), renderer, components and templates, editor, Payload plugin, Next.js integration, the example application with end-to-end tests, localization |
| Formerly "0.2" | The new editor visual identity (phase 13, [editor-design.md](editor-design.md)); the MCP server for AI agents (phase 14, [mcp.md](mcp.md), ADR-024); computed (effective) style values across breakpoints ([styles.md](styles.md)); style-state (`hover` / `focus-visible` / `active`) support in the core style model and compiler (no editor UI for it) |
| Everything else in the old 0.2, 0.3 and 1.0 lists | Not done, see below |

## Known gaps / not in 1.0.0

An honest list. None of these is implemented; do not rely on them. Where an item is listed for a later bucket it is an intention, not a commitment, and nothing is scheduled.

**Editor and product**

- Multi-select, style presets (global classes), an editor UI for style states, an IndexedDB safety copy, builder-native version history and restore, saving a section as a template, editing theme tokens from a Payload global, a translation workflow view with XLIFF/JSON export and import, an editor plugin API (custom controls and panels), a CodeMirror formula editor with autocomplete, a `/` quick-insert and command palette, header/footer as global layouts, Payload document-locking integration, showing style values inherited from an ancestor node.
- Components: Tabs, Toggle, Alert, Video, Gallery, Carousel, RadioGroup; Modal, Drawer, Tooltip, FileUpload, Filter, Search, Embed, sandboxed Custom HTML; FormStep. Templates: Team, Newsletter, RelatedPosts, ProductCard/Grid/Listing/Showcase.
- A second batch of accessibility rules (`color-contrast`, `dialog-name`, `tabs-structure`, ...), axe inside the canvas, responsive custom-component props through a CSS variable, a restricted `calc()`.
- Symbols (linked components), container queries, per-language layouts, RTL, a `buildr migrate` CLI, an "interact" canvas mode, a standalone cross-origin editor application with a handoff flow, a commerce adapter, a documentation site (`apps/docs`; the documentation is in-repo markdown).

**Quality, process and assurance**

- Performance budgets are neither measured nor enforced in CI, and 5000-node behaviour has not been validated.
- No external security audit and no WCAG 2.2 AA audit of the editor have been done. The editor is checked with axe (WCAG 2.0/2.1 A and AA) on its baseline states and was walked with the keyboard; that is not an audit.
- No document-migration LTS policy is documented. Migrations are forward-only and released ones are immutable ([migrations.md](migrations.md)), and saved documents have been protected since the first release, but there is no longer-term support promise.
- The nightly workflow is a skeleton (lint, boundaries, typecheck, test and build on Node 22 and 24). The Next.js/Payload/database compatibility matrix and the benchmarks that earlier planning described do not exist, and CI does not run `publint`, `@arethetypeswrong/cli` or `size-limit`.
- PB-146 (preview screenshots for agents) is optional and **not implemented**; the MCP server offers `get_preview_url` instead.
- The agent evals (`packages/mcp/evals`) are a harness only: no published results and no threshold.
- OAuth for the MCP endpoint: only Payload API keys are supported (ADR-024).
- A getting-started run on a fresh machine by someone outside the project, and a trademark policy for the name "Buildr".

## Out of scope in 1.0.0

Collaboration, multiplayer, presence, comments; AI generation inside the product (the MCP server only exposes tools to an external agent); a marketplace; advanced animations, Lottie; full e-commerce (variants, cart, checkout, account); custom HTML/JS and Embed; linked symbols; container queries; per-language layouts, RTL and per-language publish status; server-only components; a `user`/personalization scope; `searchParams` in bindings; nested Loop queries; `calc()` in styles. The deferred components, editor features and workflow items are the "Known gaps" above.
