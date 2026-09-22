# MVP scope and roadmap

## Scenarios the MVP must support end to end

| # | Scenario | Built from |
|---|---|---|
| 1 | A simple landing page | Section, Container, Stack, Grid, Heading, Text, Button, Image, Icon, Card, Accordion, plus the Hero, FeatureGrid, Testimonial, Pricing, FAQ, CTA templates |
| 2 | A company/marketing page | Plus RichText, List, Divider, Badge, a Card grid, Contact |
| 3 | A blog post | The `posts` collection template: PostHeader (Heading bound to `post.title`, a formatted date, Image bound to `post.featuredImage`), AuthorBox (bound to `post.author`), PostContent (RichText bound to `post.content`) |
| 4 | A post listing | A "blog" page: Loop (`query posts`, `page` bound to `route.params.page`) plus PostCard plus Pagination (bound to `loop.page`/`loop.totalPages`) |
| 5 | A simple product page | The `products` collection template: ProductHero (a Loop over `product.images`, a heading, a formatted price, a Button linking to `product.buyUrl`), ProductDetails (RichText bound to `product.description`, an attribute list) |
| 6 | A page with a form | The Contact template: Form plus Input (name, email), Textarea, Checkbox (consent), a submit Button posting to `buildr-form-submissions` |
| 7 | Localization (cross-cutting) | Scenarios 1-6 in the example application in `pl` (default) and `en`: translation in the editor, CMS data fetched per locale, `/{locale}/...` routes, hreflang |

## MVP exit criteria

- All six scenarios (plus the localization scenario) pass end-to-end tests on `example-next-payload`, in both locales, including the in-editor translation flow.
- The performance budgets in [performance.md](performance.md) hold on a 1000-node fixture.
- Seed content has zero accessibility errors (the static validator and axe both agree).
- Getting-started works on a clean machine in under 15 minutes.
- 0.1.0 is published to npm with provenance.

See [core-concepts.md](core-concepts.md), [components.md](components.md) and [templates.md](templates.md) for what these scenarios are built from, and section B of the project's original planning document for the exhaustive MVP checklist.

## Roadmap

```
MVP 0.1 -> v0.2 "Productivity" -> v0.3 "Extensibility and scale" -> v1.0 "Stability" -> post-1.0
```

| Version | Scope |
|---|---|
| **0.1 (MVP)** | Everything above. |
| **0.2** | Multi-select; style presets (global classes in the theme); style states (hover/focus-visible/active); a local IndexedDB safety copy; builder-native version history and restore; saving a section as a reusable template; editing theme tokens from a Payload global; a translation workflow (a dedicated "translate" view, XLIFF/JSON export/import); an editor plugin API (custom controls, panels); a CodeMirror-based formula editor with autocomplete; a `/` quick-insert and command palette; header/footer as global layouts; Tabs, Toggle, Alert, Video, Gallery, Carousel, RadioGroup components; Team, Newsletter, RelatedPosts, ProductCard/Grid/Listing/Showcase templates; the second batch of accessibility rules; axe running inside the canvas; responsive custom-component props via a CSS variable; showing inherited (computed) style values; a documentation site (`apps/docs`); Payload document-locking integration. |
| **0.3** | Symbols (linked components with overrides); container queries; Embed (an allowlisted provider set) and sandboxed Custom HTML; Filter/Search (client-side, `searchParams`-based); FileUpload; Modal/Drawer/Tooltip; a standalone, cross-origin editor application (`apps/page-builder`) with a handoff auth flow; per-language layouts as an opt-in plugin option; RTL support; a `buildr migrate` CLI for bulk migrations; an "interact" canvas mode; evaluating "server islands"; performance validation at 5000 nodes. |
| **1.0** | Freezing the public API under semver guarantees; a document-migration LTS policy; a WCAG 2.2 AA audit of the editor; an external security audit; a stable plugin API; a commerce adapter (variants, a cart via an external engine such as Payload's own ecommerce plugin); FormStep; a restricted `calc()`; complete documentation and migration guides; performance budgets enforced in CI. |
| **post-1.0** | Collaboration (Yjs) plus presence plus comments; AI-assisted generation; a templates/components marketplace. |

## Explicitly out of scope for MVP

Collaboration, multiplayer, presence, comments (post-1.0) - AI generation - a marketplace - advanced animations, Lottie - full e-commerce (variants, cart, checkout, account) - custom HTML/JS, Embed (v0.3) - linked symbols (v0.3) - container queries (v0.3) - hover/focus style states (v0.2) - style presets / global classes (v0.2) - multi-select (v0.2) - a translation workflow / XLIFF export (v0.2) - per-language layouts and RTL (v0.3) - per-language publish status - Tabs, Toggle, Alert, Video, Gallery, Carousel, RadioGroup (v0.2) - Modal, Drawer, Tooltip, FileUpload, Filter, Search (v0.3) - FormStep (v1.0) - editing theme in the CMS (v0.2) - builder-native version history (v0.2; MVP uses Payload Admin) - a local IndexedDB safety copy (v0.2) - an editor plugin API (v0.2) - a standalone cross-origin editor (v0.3) - server-only components (v1.0+) - a `user`/personalization scope - `searchParams` in bindings - nested Loop queries - `calc()` in styles (v1.0) - a documentation site (v0.2; MVP uses in-repo markdown).
