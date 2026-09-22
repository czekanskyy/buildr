# Component catalog

The catalog is deliberately not a copy of Elementor or Divi. It is built from a small set of primitives, plus **templates** (composites) assembled from them — see [templates.md](templates.md). Many items that other builders ship as bespoke components (blog cards, product galleries, dynamic fields) are templates here, built from `Loop`, bindings and ordinary primitives, and are therefore fully editable rather than opaque widgets.

## Priorities by release

| Group | MVP | v0.2 | v0.3 | v1.0+ | Merged / replaced by |
|---|---|---|---|---|---|
| Layout | Section, Container, Stack, Grid | — | — | — | Flex and Group become **Stack** (`role=group`); a dedicated Slot component becomes **slots + regions** |
| Content | Heading, Text, RichText, Link, Button, Icon, List (+ListItem), Badge, Divider | — | — | — | ButtonGroup becomes a **Stack preset** |
| Media | Image | Video, Gallery, Carousel | Embed | Lottie (plugin) | — |
| UI | Card, Accordion (+Item) | Tabs, Toggle, Alert | Modal, Drawer, Tooltip | — | — |
| Forms | Form, Input, Textarea, Select, Checkbox | RadioGroup | FileUpload | FormStep | — |
| CMS | Loop, Pagination | — | Filter, Search | — | Query becomes **`Loop.source = query`**; DynamicField becomes **bindings on every component** |
| Blog | PostCard, PostGrid/BlogListing, PostHeader, PostContent, AuthorBox (templates) | RelatedPosts | — | Comments (plugin) | all of these are **templates**, not standalone components |
| Commerce | ProductHero, ProductDetails (templates) | ProductCard, ProductGrid, ProductListing, ProductShowcase | — | ProductVariants, AddToCart, Cart, Checkout, Account (commerce adapter) | ProductInfo/ProductGallery become **templates** |
| Composites | Hero, CTA, Feature, FeatureGrid, Testimonial, Pricing, FAQ, Contact, BlogListing | Team, Newsletter | — | — | — |

## Component index (MVP)

Each entry below is expanded with full detail once its implementation task lands (see [ai/component-development.md](ai/component-development.md) for the required content and the [backlog](backlog/README.md) for build order). This file is the living catalog referenced by AGENTS.md and updated by every component task's Definition of Done.

- **Layout**: Page, Section, Container, Stack, Grid
- **Content**: Heading, Text, RichText, Link, Button, Icon, List, ListItem, Divider, Badge
- **Media**: Image
- **UI**: Card, Accordion, AccordionItem
- **CMS**: Loop, Pagination
- **Forms**: Form, Input, Textarea, Select, Checkbox
- **Templates**: Hero, CTA, Feature, FeatureGrid, Testimonial, Pricing, FAQ, Contact, PostHeader, PostCard, BlogListing, AuthorBox, PostContent, ProductHero, ProductDetails

## Form field derivation

Any component may declare `ComponentMeta.formField` (see [component-registry.md](component-registry.md)) to participate in form schema derivation. `deriveFormSchema(doc, registryMeta, formNodeId)` (in `@buildr/core/forms`) walks a `buildr/form` node's descendants and reads `formField` metadata generically — it never imports specific components — so custom form controls participate automatically. This function is the server-side source of truth for what a submitted form is allowed to contain; see [payload.md](payload.md) and [security.md](security.md).
