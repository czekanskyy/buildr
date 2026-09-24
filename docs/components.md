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

## Layout components

### Page (`buildr/page`)

The document root: one per document, never inserted, moved, removed or duplicated (`capabilities.root`). A plain `div` with a `default` slot; landmarks are Sections, so a page can have several. Its CSS sets the base text colour, surface and body font from tokens.

### Section (`buildr/section`)

A band of the page. Props: `as` (`section`, `div`, `header`, `footer`, `main`, `aside`, `nav`, `article`; anything else renders `section`), `container` (`full`, `sm`, `md`, `lg`, `xl`: the content column, taken from the theme's `container` tokens and done with padding, so there is no wrapper element), `backgroundImage` (bindable media, drawn as a decorative `<img>` behind the content, through `platform.Image`), `ariaLabel` (localizable). A landmark element (`section`, `aside`, `nav`, `header`, `footer`) should be named with `ariaLabel`; the a11y rules check one `main` and named navigations.

### Container (`buildr/container`)

Centres its content in a column no wider than `width` (`sm`, `md`, `lg`, `xl`, from the `container` tokens). One `div`, `default` slot.

### Stack (`buildr/stack`)

A flex container with a `default` slot (`axis: 'auto'`, so drag-and-drop follows the computed direction). Direction, wrap, gap and alignment are the `layout.*` style properties and can change per breakpoint; the component CSS only defaults to a column with a `space-4` gap. Props: `role` (`none`, `group`, `list`; use `group` with an `ariaLabel`, and `list` only with ListItem children) and `ariaLabel`.

### Grid (`buildr/grid`)

A grid container. Columns come from the `layout.columns` style (a whole number 1–12, per breakpoint); a child's width from its own `layout.columnSpan` (1–12). Without them the grid fills the row with columns at least 16rem wide. A named grid (`ariaLabel`) is exposed as a `group`.

## Content components

### Heading (`buildr/heading`)

`h1`–`h6`. Props: `text` (bindable, localizable) and `level` (1–6, default 2). The level is the outline; the look is a style: the CSS gives each level a default size from the `fontSize` tokens, and a typography style on the node overrides it, so a small `h2` is possible. A stored level outside 1–6 renders an `h2`. `editor.inlineProp` is `text`. The a11y rules `heading-order` and `empty-heading` apply.

### Text (`buildr/text`)

A paragraph. Props: `text` (multi-line, bindable, localizable; line breaks are kept, markup is never interpreted) and `as` (`p`, `span`, `small`, `div`; anything else renders `p`). Use `span` inside parents that only take phrasing content (buttons, links). `editor.inlineProp` is `text`.

### RichText (`buildr/rich-text`)

Formatted content from a `richText` prop (`content`, bindable, localizable): headings, paragraphs, lists, quotes, links, and bold/italic/strikethrough/underline/code/sub/superscript. Rendered by `renderRichText` from `@buildr/react`, so it is an allowlist walker with sanitized links (through `platform.Link`), never HTML. A bound plain string arrives as one paragraph (core coerces it). Its typography is scoped CSS (`.bc-rich-text :where(h2, p, ul, …)`), all from tokens; it does not affect the rest of the page. This is what the PostContent template uses.

### Button (`buildr/button`)

An action or a call to action. Props: `label` (bindable), `href` (bindable link), `type` (`button` or `submit`), `variant` (`primary`, `secondary`, `outline`, `ghost`), `size` (`sm`, `md`, `lg`), `icon` (a name from `ICON_NAMES`), `iconPosition` (`start`, `end`), `ariaLabel`, `newTab`. With a `href` it renders a link through `platform.Link` (the default platform and the Next.js one both work, since it only needs an `<a>`-like component); without one, a real `<button>`. A URL that fails sanitization (`javascript:`, `data:`, …) is dropped when the prop is resolved, so the component falls back to a plain button; it never renders an unsafe `href`. An icon-only button (`label` empty) must have an `ariaLabel`: the `button-name` a11y rule reports it otherwise. The icon is decorative.

### Link (`buildr/link`)

A text link: `label`, `href` (default `#`; an unsafe URL resolves to the default), `ariaLabel`, `newTab`.

**New tab.** `newTab` adds `target="_blank"` and `rel="noopener noreferrer"`, and tells assistive technology: a visually hidden ` (opens in a new tab)` after the text, or, when `ariaLabel` replaces the text, the same notice appended to the name. The notice is a built-in message (`link.newTab`, in `BUILT_IN_MESSAGES` for `en` and `pl`); a site's own `messages` (passed to the renderer) win over it.

Both are `interactive` content, so the content-model and `nested-interactive` rules keep other interactive content out of them; both are inline-editable through `label`.

## Media components

### Image (`buildr/image`)

A picture from the media library or bound to a CMS field. Props: `image` (bindable media), `alt` (bindable, localizable; empty falls back to the alt stored with the media asset), `decorative` (empty `alt` and `role="presentation"`; the `image-alt` rule then does not apply), `sizes` (display-width preset: `full`, `half`, `third`, `quarter`, giving the `sizes` attribute), `fit` (`object-fit`), `priority` (passed to the platform image; a plain `<img>` gets `loading="eager"` instead of `lazy`).

Rendering: through `platform.Image` (`next/image` in a Next.js site, a plain `<img>` otherwise), with `src`, intrinsic `width`/`height`, a `srcset` built from the sizes the media library generated (plus the original, narrowest first), and the asset's focal point as `object-position`. Every URL goes through `sanitizeUrl` again: an unsafe or missing URL renders nothing, except in the editor's canvas (`mode: 'canvas'`), where an empty-state placeholder (`data-empty`) marks the spot.

### Icon (`buildr/icon`), List and ListItem, Divider, Badge

- **Icon** (`buildr/icon`; the definition is exported as `IconComponent` because `Icon` is the svg component): `name` (one of `ICON_NAMES`), `label`, `size` (`sm`, `md`, `lg`, `xl`). Decorative (`aria-hidden`) unless it has a `label` (`role="img"`). Drawn on the server from path data, no JavaScript; an unknown name renders nothing.
- **List** (`buildr/list`): `ordered` (`ol` or `ul`), `ariaLabel`. Its slot accepts only `#list-item` and `buildr/loop`; a new List comes with three items. The `list-structure` rule and the slot rules agree.
- **ListItem** (`buildr/list-item`): `text` (bindable, inline-editable) and a slot for more content (a nested list). Only valid inside a List or a Loop; not insertable on its own.
- **Divider** (`buildr/divider`): an `<hr>`; `decorative` makes it `role="presentation"`.
- **Badge** (`buildr/badge`): `text` (bindable) and `variant` (`neutral`, `primary`, `success`, `warning`, `danger`); the colour is decoration, so put the meaning in the text.

Fixtures: each component exports `<name>Fixtures` (`ComponentFixture`: an id, a title and a subtree that goes under the page), reviewed at `FIXTURE_WIDTHS` (1280, 768, 375). Tablet and mobile overrides live in the fixture's `styles.bp`.

## Form field derivation

Any component may declare `ComponentMeta.formField` (see [component-registry.md](component-registry.md)) to participate in form schema derivation. `deriveFormSchema(doc, registryMeta, formNodeId)` (in `@buildr/core/forms`) walks a `buildr/form` node's descendants and reads `formField` metadata generically — it never imports specific components — so custom form controls participate automatically. This function is the server-side source of truth for what a submitted form is allowed to contain; see [payload.md](payload.md) and [security.md](security.md).
