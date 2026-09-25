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

### Editor icons (`meta.icon`)

Each built-in component has a distinct [lucide](https://lucide.dev) icon (kebab-case name) so it is recognisable in the palette and the layers tree. Uniqueness is enforced by a playground test (PB-121).

| Component | Icon | Component | Icon |
|---|---|---|---|
| Page | `file` | Badge | `tag` |
| Section | `rectangle-horizontal` | Divider | `separator-horizontal` |
| Container | `square-dashed` | List | `list` |
| Stack | `rows-3` | ListItem | `dot` |
| Grid | `layout-grid` | Accordion | `chevrons-up-down` |
| Card | `panel-top` | AccordionItem | `chevron-down` |
| Heading | `heading` | Loop | `repeat` |
| Text | `type` | Pagination | `ellipsis` |
| RichText | `pilcrow` | Form | `clipboard-list` |
| Link | `link` | Input | `text-cursor-input` |
| Button | `mouse-pointer-click` | Textarea | `text-align-start` |
| Image | `image` | Checkbox | `square-check` |
| Icon | `sparkles` | Select | `square-chevron-down` |

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

## UI components

### Card (`buildr/card`)

A boxed piece of content. Slots: `media` (one media item), `body` (flow content), `actions` (interactive content, laid out horizontally). Props: `variant` (`outlined`, `elevated`, `flat`), `as` (`article` or `div`), and for a clickable card `href`, `linkLabel` and `newTab`.

**Stretched link.** With a `href` the card contains one real anchor (`.bc-card__link`), empty apart from its name (`linkLabel`, plus a hidden new-tab notice), whose `::after` covers the card. The card's own content is never inside the link, so a Button or Link in `actions` (raised with `z-index: 1`) does not nest interactive elements; the `nested-interactive` rule stays quiet. An unsafe URL drops the link. Give a linked card a `linkLabel`; it is the link's accessible name.

### Accordion (`buildr/accordion`) and AccordionItem (`buildr/accordion-item`)

Expandable sections built on native `<details>`/`<summary>`: no JavaScript, and the browser supplies the keyboard behaviour (Enter or Space on the summary) and the semantics. **Accordion**: `allowMultiple` (default on). Off, every item gets the same `name` (derived from the accordion's node id, so two accordions never share a group) and opening one closes the others; a browser without `name` support on `details` degrades to independent items. Its slot accepts only accordion items (or a Loop; items a Loop produces are not exclusive, since their parent is the Loop). A new accordion comes with three items. **AccordionItem**: `summary` (bindable, required by the `accordion-structure` rule), `defaultOpen`, and a content slot; inline-editable through `summary`, `editor.revealOnSelect` (the editor opens the item when it is selected), not insertable on its own.

## CMS components

### Loop (`buildr/loop`)

Repeats its `item` slot once per entry of a list: `source` is a collection query (with `limit` and an optional `page`) or a list from the data (`post.related`). Inside the template `item` is the entry (or the name given in `as`, so nested loops can reach the outer item), `index` its position and `loop` the list (`loop.page`, `loop.totalPages`, `loop.total`). `empty` shows when the list has no entries; `after` shows once below the entries, with the `loop` scope in reach. Layout is the Loop's own styles: make it a grid (`layout.display: grid`, `layout.columns`) or a stack; `after` spans every column. At most 1000 entries are rendered.

### Pagination (`buildr/pagination`)

A `nav` landmark of real page links: `page` and `totalPages` (bindable; in a Loop's `after` slot bind them to `loop.page` and `loop.totalPages`), `hrefPattern` (`{page}` is replaced by the page number; default `?page={page}`; the result is sanitized again, and an unsafe pattern gives items without links) and `ariaLabel`. It shows the first and last page and the current one with a neighbour either side, with gaps (`1 … 4 5 6 … 12`), the current page marked with `aria-current="page"`, and previous and next links. `page` is clamped to `1..totalPages`. One page or none renders nothing on a published page, and still renders in the editor's canvas so it can be selected. Its texts are built-in messages (`pagination.*`, `en` and `pl`).

Fixtures: each component exports `<name>Fixtures` (`ComponentFixture`: an id, a title and a subtree that goes under the page), reviewed at `FIXTURE_WIDTHS` (1280, 768, 375). Tablet and mobile overrides live in the fixture's `styles.bp`.

## Form components

A form is a plain HTML `<form method="post">` whose action comes from `platform.formAction(env.layoutRef, node.id)`, so it works without JavaScript; a small client enhancement (`FormEnhancer`) sends it with `fetch`, keeps the person on the page and reports the result in a live region. The enhancement validates nothing: the server checks the submission against the schema derived from the document (see below) and returns per-field errors, which are shown next to the fields.

### Form (`buildr/form`)

Container for fields and a submit button (`form-submit` a11y rule). Props: `successMessage`, `errorMessage` (default to the built-in `form.success`/`form.error` messages for the locale), `ariaLabel`. It renders a hidden honeypot field `_hp` (out of the tab order, `aria-hidden`); a submission that fills it is treated as spam. Nested forms are not allowed and their fields are ignored by the schema.

### Input (`buildr/input`), Textarea (`buildr/textarea`), Select (`buildr/select`), Checkbox (`buildr/checkbox`)

Each renders one wrapper: a `label` tied to the control, an optional `hint` (wired with `aria-describedby`), a required marker (`*`, hidden from screen readers; the `required` attribute carries the meaning) and an empty error region. `name` is a static, non-bindable prop (letters, digits, `_`, `-`; starting with a letter; at most 64 characters; `_hp` and other reserved names are refused). All four are only valid inside a form (`requireAncestor`).

- **Input**: `type` is one of `text email tel url number date` (anything else falls back to `text`); `maxLength` (0 = no limit).
- **Textarea**: `rows` (2–30), `maxLength`.
- **Select**: `options` is a list of `{ label, value }`; entries without a value are skipped and an empty label shows the value. `placeholder` becomes an empty first choice, unselectable when the field is required. The values shown are exactly those the server accepts.
- **Checkbox**: label after the box (always visible), `defaultChecked`; a boolean field.

Field ids are derived from the node id, so they are stable between server and client rendering.

## The default registry

`createDefaultRegistry()` returns a `ReactRegistry` with every component (`defaultComponents`, 26) and every template (`defaultTemplates`, 14) of this package; `defaultTheme` is the theme they are designed against (the core default, re-exported), so an application needs one import. Extend it with `registry.extend({ components, templates })`: each call builds a new registry and nothing is shared or global.

```ts
import { createDefaultRegistry, defaultTheme } from '@buildr/components';
import '@buildr/components/styles.css';

const registry = createDefaultRegistry().extend({ components: [MyHero] });
```

The registry's manifest (`toManifest(registry.meta)`, what the editor loads) is kept under 60 KB; a test enforces it. Template thumbnails are therefore compact wireframes (one path per tone, a few hundred bytes), and templates keep their responsive overrides to what they need.

**The gallery.** `galleryEntries` lists every component in each of its states and every template and variant (`group: 'component' | 'template'`, `of`: the type or template id). Render an entry under a page with `createGalleryDataSource()` and `gallerySampleScopes`; review it at the widths of `FIXTURE_WIDTHS`. The test suite runs every entry through `validateDocument`, `runA11y` (no errors) and, server-rendered into jsdom, `vitest-axe` (colour contrast and page-level rules are switched off there: jsdom has no layout, and an entry is a fragment).

## Marketing templates

`marketingTemplates` (in `@buildr/components`) are ordinary `TemplateDefinition`s built only from the components above, with tablet and mobile overrides on the nodes that need them (see [templates.md](templates.md)). Each is a detached, fully editable copy once inserted. Each has an SVG wireframe `thumbnail` (a compact data URI drawn from plain shapes) and a gallery fixture in `marketingTemplateFixtures` (one per template and variant).

| Template | Id | Made of | Notes |
|---|---|---|---|
| Hero | `buildr/hero` | Section, Grid, Stack, Heading (H1), Text, Buttons, Image | `lock: structure`; the buttons are the editable `actions` region. Variants: default (picture first), `imageRight`, `centered` (no picture). Two columns, one on a phone. |
| Feature grid | `buildr/feature-grid` | Section, Stack, Grid, Icon, Heading, Text | Six features; three columns, two on tablet, one on mobile. |
| Call to action | `buildr/cta` | Section, Stack, Heading, Text, Button | On `$color.primary` with `$color.on-primary` text; `lock: structure` with an `actions` region. |
| Testimonial | `buildr/testimonial` | Section, Stack, Text | A quote and its author. |
| Pricing | `buildr/pricing` | Section, Grid, Card, Badge, List, Button | Three plans, one highlighted; stacked on tablet and mobile. |
| FAQ | `buildr/faq` | Section, Accordion | Four questions, the first open. |
| Contact | `buildr/contact` | Section, Grid, Form, Input, Textarea, Checkbox, Button | Name, email, message and a copy checkbox; the fields have static names so the server can derive the schema. |

Headings start at level 2 (the layout renders the page's H1); only the Hero uses level 1, so a page using it should not also have a layout H1 (`expectH1: 'document'`). The Image in a Hero has no media until the author chooses one: it renders nothing on a published page and a marked empty state in the editor's canvas. Copy is placeholder text meant to be replaced.

## Blog and product templates

`contentTemplates` are for a collection's document or a list of them. They are bound to `post.*`, `product.*`, `item.*` and `loop.*` (fields as in [payload.md](payload.md)), so they belong on a post or product page or inside a Loop. Nothing in them is a special component: each is a tree of the primitives above, fully editable once inserted. `templateSampleScopes` and `templateSampleCollections` are sample data of those shapes, used by the tests and the gallery.

| Template | Id | Binds to | Notes |
|---|---|---|---|
| Post header | `buildr/post-header` | `post.title` (the page's H1, "Untitled" if empty), `post.publishedAt` (long date), `post.featuredImage` | Smaller heading on tablet and mobile. |
| Post content | `buildr/post-content` | `post.content` (rich text) | Reading-width column. |
| Author box | `buildr/author-box` | `post.author.{avatar,name,jobTitle,bio}` | An `aside` labelled "About the author". |
| Post card | `buildr/post-card` | `item.{path,title,featuredImage,publishedAt,excerpt}` | For a Loop's `item` slot. The whole card links to `item.path` (the adapter supplies the URL of each item) and is named by `item.title`. |
| Blog listing | `buildr/blog-listing` | query `posts`, newest first, 6 per page, `page` from `route.params.page` | A Loop as a grid (three columns, two, one) with the Post card, an empty message and a Pagination bound to `loop.page`/`loop.totalPages`. Its heading is the page's H1. |
| Product hero | `buildr/product-hero` | `product.images` (a Loop), `product.title` (H1), price, `product.shortDescription`, `product.buyUrl` | The price is the formula `formatCurrency(product.price, product.currency)`. A buy link that is not safe is dropped and the button is left without one. |
| Product details | `buildr/product-details` | `product.description` (rich text), `product.attributes` (a Loop of name and value) | |

A binding that finds nothing falls back (the post title to "Untitled") or renders empty and reports `binding.missing`, so these templates show diagnostics if they are put where the data does not exist.

## Form field derivation

Any component may declare `ComponentMeta.formField` (see [component-registry.md](component-registry.md)) to participate in form schema derivation. `deriveFormSchema(doc, registryMeta, formNodeId)` (in `@buildr/core/forms`) walks a `buildr/form` node's descendants and reads `formField` metadata generically — it never imports specific components — so custom form controls participate automatically. It returns `{ schema: { formId, fields: [{ nodeId, name, valueType, required, maxLength?, options? }] }, diagnostics }`. Only static prop values are read: a dynamic `name` or `options` is reported (`form.name-dynamic`, `form.options-dynamic`) and the field is left out, as are missing, invalid, reserved or duplicate names (`form.name-missing`, `form.name-invalid`, `form.name-duplicate`) and fields beyond the limit (`form.too-many-fields`). This function is the server-side source of truth for what a submitted form is allowed to contain; see [payload.md](payload.md) and [security.md](security.md).
