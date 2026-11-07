# Component catalog

The catalog is deliberately not a copy of Elementor or Divi. It is built from a small set of primitives, plus **templates** (composites) assembled from them — see [templates.md](templates.md). Many items that other builders ship as bespoke components (blog cards, product galleries, dynamic fields) are templates here, built from `Loop`, bindings and ordinary primitives, and are therefore fully editable rather than opaque widgets.

## Priorities by release

| Group | MVP | v0.2 | v0.3 | v1.0+ | Merged / replaced by |
|---|---|---|---|---|---|
| Layout | Container, Grid | — | — | — | Section, Stack, Flex and Group become **Container** (`display`, `as`, `width`, `bleed`, `role`); a dedicated Slot component becomes **slots + regions** |
| Content | Heading, Text, RichText, Link, Button, Icon, List (+ListItem), Badge, Divider | — | — | — | ButtonGroup becomes a **Container preset** |
| Media | Image | Video, Gallery, Carousel | Embed | Lottie (plugin) | — |
| UI | Card, Accordion (+Item) | Tabs, Toggle, Alert | Modal, Drawer, Tooltip | — | — |
| Forms | Form, Input, Textarea, Select, Checkbox | RadioGroup | FileUpload | FormStep | — |
| CMS | Loop, Pagination | — | Filter, Search | — | Query becomes **`Loop.source = query`**; DynamicField becomes **bindings on every component** |
| Blog | PostCard, PostGrid/BlogListing, PostHeader, PostContent, AuthorBox (templates) | RelatedPosts | — | Comments (plugin) | all of these are **templates**, not standalone components |
| Commerce | ProductHero, ProductDetails (templates) | ProductCard, ProductGrid, ProductListing, ProductShowcase | — | ProductVariants, AddToCart, Cart, Checkout, Account (commerce adapter) | ProductInfo/ProductGallery become **templates** |
| Composites | Hero, CTA, Feature, FeatureGrid, Testimonial, Pricing, FAQ, Contact, BlogListing | Team, Newsletter | — | — | — |

## Component index (MVP)

Each entry below is expanded with full detail once its implementation task lands (see [ai/component-development.md](ai/component-development.md) for the required content and the [backlog](backlog/README.md) for build order). This file is the living catalog referenced by AGENTS.md and updated by every component task's Definition of Done.

- **Layout**: Page, Container, Grid, Spacer, Anchor
- **Content**: Heading, Text, RichText, Link, Button, Icon, List, ListItem, Divider, Badge
- **Media**: Image, Video, Iframe, Map, Carousel, CarouselSlide, Gallery, GalleryItem
- **UI**: Card, Accordion, AccordionItem
- **CMS**: Loop, Pagination
- **Forms**: Form, Input, Textarea, Select, Checkbox, Fieldset, Captcha
- **Templates**: Hero, CTA, Feature, FeatureGrid, Testimonial, Pricing, FAQ, Contact, PostHeader, PostCard, BlogListing, AuthorBox, PostContent, ProductHero, ProductDetails

### Editor icons (`meta.icon`)

Each built-in component has a distinct [lucide](https://lucide.dev) icon (kebab-case name) so it is recognisable in the palette and the layers tree. Uniqueness is enforced by a playground test (PB-121).

| Component | Icon | Component | Icon |
|---|---|---|---|
| Page | `file` | Image | `image` |
| Container | `square-dashed` | Icon | `sparkles` |
| Grid | `layout-grid` | Badge | `tag` |
| Card | `panel-top` | Divider | `separator-horizontal` |
| Heading | `heading` | List | `list` |
| Text | `type` | ListItem | `dot` |
| RichText | `pilcrow` | Accordion | `chevrons-up-down` |
| Link | `link` | AccordionItem | `chevron-down` |
| Button | `mouse-pointer-click` | Loop | `repeat` |
| Input | `text-cursor-input` | Pagination | `ellipsis` |
| Textarea | `text-align-start` | Form | `clipboard-list` |
| Checkbox | `square-check` | Select | `square-chevron-down` |
| Video | `video` | Iframe | `globe` |
| Spacer | `space` | Anchor | `hash` |
| Fieldset | `group` | Map | `map-pin` |
| Carousel | `gallery-horizontal` | CarouselSlide | `rectangle-horizontal` |
| Gallery | `images` | GalleryItem | `square` |

## Layout components

### Page (`buildr/page`)

The document root: one per document, never inserted, moved, removed or duplicated (`capabilities.root`). A plain `div` with a `default` slot; landmarks are Containers (`as`), so a page can have several. Its CSS sets the base text colour, surface and body font from tokens.

### Container (`buildr/container`, version 3)

The one box that lays out children; it replaces the former Section and Stack ([ADR-025](adr/ADR-025-retiring-a-component-type.md)). Props:

- `display`: `flex` (default, a column with a `space-4` gap), `block` (shown as "Box"), `grid`, `inline-flex`, `inline-block`. Direction, wrap, gap and alignment are the `layout.*` styles and can change per breakpoint; the slot axis follows the computed layout, so drag-and-drop knows the direction. A `layout.display` style on the node wins over the `display` prop (node CSS is in `@layer buildr.nodes`), see [styles.md](styles.md).
- `as`: the element, `div` by default, or `section`, `header`, `footer`, `main`, `aside`, `nav`, `article`. A landmark should be named with `ariaLabel`; the a11y rules check one `main` and named navigations.
- `width`: the content column (`sm`, `md`, `lg`, `xl`, from the theme's `container` tokens; default `lg`), or `none` ("No limit").
- `bleed`: the box spans its parent (a full-width background) and keeps the content to the column with padding.
- `backgroundImage`, `backgroundVideo`, `backgroundPoster`, `backgroundOverlay`: bindable media. The image is a decorative `<img>` behind the content; the video is muted, looping, inline, without controls and `aria-hidden`; the poster (or else the image) is the still. `backgroundOverlay` is an image above the media. Each may be a library asset or an external https URL (see External sources below).
- `overlayTone` (`none`, `dark`, `light`) and `overlayOpacity` (0 to 1, default 0.5): a scrim drawn from theme tokens, with or without media.
- `backgroundFit` (`cover`, `contain`), `backgroundPosition` (`center`, `top`, `bottom`, `left`, `right` and the four corners) and `backgroundAttachment` (`scroll`, `fixed`). They are container props because the media are elements; the core `repeat`, `attachment`, `position` and `imageSize` styles still apply to the node's own CSS background. Under `prefers-reduced-motion` the video is hidden so the still shows, and a fixed background scrolls.
- `role` (`none`, `group`, `list`, plain `div` only: a landmark element keeps its own role; use `group` with an `ariaLabel`, and `list` only with ListItem children) and `ariaLabel` (localizable).

The options reach the CSS as data attributes (`data-display`, `data-width`, `data-bleed`, `data-has-background`, `data-has-video`, `data-external-media`). It has the `size` style group, and its content category includes `landmark`. Version 3 only adds props (identity migration). Stored version 1 containers become `display: 'block'`, so they look as before; stored `buildr/section` and `buildr/stack` nodes are rewritten into containers on load (a stack: flex column, no width limit; a section: `bleed` flex column keeping its element, width, image and name).

### Grid (`buildr/grid`)

A grid container. Columns come from the `layout.columns` style (a whole number 1–12, per breakpoint); a child's width from its own `layout.columnSpan` (1–12). Without them the grid fills the row with columns at least 16rem wide. A named grid (`ariaLabel`) is exposed as a `group`.

## Content components

### Heading (`buildr/heading`)

`h1`–`h6`. Props: `text` (bindable, localizable), `level` (1–6, default 2) and `tag` (`heading` by default = `h{level}`; or `p`, `span`, `div`, `strong`, which render plain text with no heading role, stay out of the outline and are skipped by the heading a11y rules; component version 2, an identity migration because a stored heading without `tag` already means `heading`). The level is the outline; the look is a style: the CSS gives each level a default size from the `fontSize` tokens, and a typography style on the node overrides it, so a small `h2` is possible. A stored level outside 1–6 renders an `h2`. `editor.inlineProp` is `text`. The a11y rules `heading-order` and `empty-heading` apply.

### Text (`buildr/text`)

A paragraph. Props: `text` (multi-line, bindable, localizable; line breaks are kept, markup is never interpreted) and `as` (`p`, `span`, `small`, `div`; anything else renders `p`). Use `span` inside parents that only take phrasing content (buttons, links). `editor.inlineProp` is `text`.

`mode` (`plain` by default, `rich`, `html`; component version 2, an identity migration because a stored text has no `mode`, which already means plain) picks how the content is written. `rich` reads the `rich` prop (a rich text value, bindable) through `renderRichText`, so it is walked, never parsed. `html` reads the `html` prop (`textarea` with `format: 'html'`, author HTML, ADR-026): it needs the host's `capabilities.authorCode`; `node.setProp` refuses it without that (`command.author-code-not-permitted`), stores the sanitised form (core's `sanitizeHtml`, a `parse5` parse with a tag and attribute allowlist: no scripts, handlers, styles, embeds or `javascript:` URLs, `target="_blank"` links get `rel="noopener noreferrer"`), and the renderer sanitises again and builds React elements with `createElement` (this package has no `dangerouslySetInnerHTML`). Without the capability at render time the Text shows its plain `text`. `rich` and `html` render a `div` (they can hold blocks) whatever `as` says.

### RichText (`buildr/rich-text`)

Formatted content from a `richText` prop (`content`, bindable, localizable): headings, paragraphs, lists, quotes, links, and bold/italic/strikethrough/underline/code/sub/superscript. Rendered by `renderRichText` from `@next-buildr/react`, so it is an allowlist walker with sanitized links (through `platform.Link`), never HTML. A bound plain string arrives as one paragraph (core coerces it). Its typography is scoped CSS (`.bc-rich-text :where(h2, p, ul, …)`), all from tokens; it does not affect the rest of the page. This is what the PostContent template uses.

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

### Video (`buildr/video`)

A video file from the media library or an external https URL. Props: `video` (bindable media, video), `poster` (media, image), `title` (the accessible name, localizable, required: it is the `aria-label`), `captions` (a WebVTT file), `captionsLanguage`, `captionsLabel`, `controls` (default on), `loop`, `autoplay`, `muted`, `preload` (`none`, `metadata`), `aspectRatio` (`16:9`, `4:3`, `1:1`, `9:16`, `21:9`, `auto`) and `fit`. Autoplay always plays muted and keeps its controls, so it never makes sound and can be paused. Without a valid video it renders nothing, except in the canvas, where an empty frame (`data-empty`) marks the spot.

### Iframe (`buildr/iframe`)

An embedded page. Props: `url` (https only, text), `title` (the accessible name, required) and `aspectRatio`. The frame is always `sandbox="allow-scripts"` (no same-origin, no popups, no top navigation), `referrerpolicy="no-referrer"` and `loading="lazy"`, with no `allow`; nothing in the props widens it. An invalid URL renders nothing; the canvas shows an empty frame marked `data-embed-invalid`.

### Map (`buildr/map`, version 1)

A Google map from the Maps Embed API ([ADR-029](adr/ADR-029-provider-embeds-and-form-challenges.md)). The author enters a place, not a URL.

| Prop | CMS contract / default |
|---|---|
| `query` | Bindable text, the place or address; empty |
| `zoom` | Number 0–21; 15. Rounded and clamped; a non-finite value becomes 15 |
| `mapType` | `roadmap` (default) or `satellite`; anything else becomes `roadmap` |
| `title` | Bindable, localizable accessible name; empty uses the localized "Map: {query}" |
| `aspectRatio` | The Iframe ratios; `16:9` |

The query is normalised: lone surrogates become U+FFFD, whitespace runs become one space, other control characters are removed, then it is trimmed. It may have at most 256 code points. An empty or longer query renders nothing on the site; the canvas shows a placeholder marked `data-embed-invalid`.

URLs are built from fixed templates. Every value goes through `encodeURIComponent` (not `URLSearchParams`, which writes `+` for a space):

- Frame: `https://www.google.com/maps/embed/v1/place?key={K}&q={Q}&zoom={Z}&maptype={M}&language={L}`. `&language={L}` is added only when `env.locale` looks like a language tag.
- Link: `https://www.google.com/maps/search/?api=1&query={Q}`. It needs no key. It always renders, opens in a new tab with `rel="noopener noreferrer"`, and its text says "opens in a new tab".

Both URLs pass `checkExternalUrl` (in `try`/`catch`: a throw counts as invalid). The frame URL is also checked against `capabilities.iframeHosts`, so a host that sets that list must include `www.google.com`.

The iframe has `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"`, `referrerpolicy="strict-origin"` and `loading="lazy"`, with no `allow` and no `allowfullscreen`. Its `title` is `title` or the fallback. No prop changes any of this. This is a deliberate, narrow widening of [ADR-028](adr/ADR-028-external-media-and-embeds.md): it holds only for the constant origin above, only when `Platform.maps` is set, and only in this block. `buildr/iframe` keeps `allow-scripts` and `no-referrer`.

Host config is `Platform.maps?: { apiKey: string; clickToLoad?: boolean }` (see [renderer.md](renderer.md#platform) and [nextjs.md](nextjs.md#implemented-api-buildrpage-and-the-next-platform-pb-103)). Absent means off. A key that does not match `^[A-Za-z0-9_-]{20,128}$` counts as absent. The key is public: it appears only in the frame URL, which is in the page HTML and RSC data before the click (no request goes out until the click). The block never stores it in the document or the manifest, and never passes it through the editor or canvas protocol.

| Situation | Output |
|---|---|
| No valid key, or host not allowed in `iframeHosts` | The link only |
| Valid key, click-to-load on (default) | Notice, "Show map" button and the link |
| Valid key, `clickToLoad: false` | The iframe in the server HTML and the link |
| Canvas | Placeholder ("The map loads only on the published site.") and the link |
| Empty or too long query | Nothing (canvas: diagnostic) |

Click-to-load is the default. Only the literal `clickToLoad: false` turns it off, and then the host must make sure consent is given before the page renders. Nothing loads from Google before the click and nothing is remembered afterwards (no cookie, no storage). The notice and the button come from a client enhancer: the button is `hidden` until hydration, so the first client render matches the server HTML. Activating it (click, Enter or Space) swaps in the iframe and moves focus to it. Without JavaScript the visitor sees the notice and the link.

The canvas (`env.mode === 'canvas'`) never loads a provider: no iframe, no script, no preconnect and no URL with a key. The view does not read `platform.maps` in the canvas, and the canvas Platform must not be given `maps`. `preview` and `production` behave the same.

Hosts whose CSP restricts frames must also allow `https://www.google.com` there, restrict the key in Google Cloud, and name Google in their privacy policy; see [security.md](security.md#provider-embeds-map). Only `place` mode is supported: no search, view, directions or street view mode, no markers and no styling. The type starts at version 1 without a migration.

### External sources ([ADR-028](adr/ADR-028-external-media-and-embeds.md))

A media prop holds either a library reference or `{ external: true, url, mimeType? }`. The renderer checks the latter on every render: https, no credentials, at most 2048 characters, and allowed by the host. The editor's confirmation dialog is feedback only. External media get `data-external-media`; an external `img` also gets `referrerpolicy="no-referrer"`. A `video` or `track` element has no `referrerpolicy` attribute, so an external video, poster or captions track is requested with the page's own referrer policy: a host that allows external video should send a page-level `Referrer-Policy` (for example `no-referrer` or `strict-origin-when-cross-origin`) so the visitor's page URL is not passed to the video host. Hosts restrict sources with `capabilities.externalMediaHosts` (media) and `capabilities.iframeHosts` (iframes): a host and its subdomains; absent means any https host, `[]` none. Only an asset the renderer resolved from `PreparedData.media` is a library asset (the renderer marks it with `markResolvedMedia`, which stored JSON cannot carry); any other object with a `url`, such as a raw value or the snapshot of a reference that was not prepared, is checked like an external source (https and the allowlist) or accepted only as a same-origin path with a single leading `/`. A host list that is present but not an array allows no host. In the canvas an unusable source shows `data-media-invalid` or `data-embed-invalid` with the reason.

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

Container for fields and a submit button (`form-submit` a11y rule). Props: `successMessage`, `errorMessage` (default to the built-in `form.success`/`form.error` messages for the locale), `ariaLabel`. It renders a hidden honeypot field `_hp` (out of the tab order, `aria-hidden`); a submission that fills it is treated as spam. Nested forms are not allowed and their fields are ignored by the schema. The `<form>` carries `data-buildr-form="{node id}"` (after the author's attributes, so they cannot override it), and the enhancer dispatches a bubbling `buildr-form:settled` event on it whenever a submission ends, whether it succeeded, failed, threw, or ran a function-valued action ([renderer.md](renderer.md#form-markup-and-the-settle-event)). Both exist for enhancers such as the captcha.

### Captcha (`buildr/captcha`, version 1)

A Cloudflare Turnstile check for a form ([ADR-029](adr/ADR-029-provider-embeds-and-form-challenges.md)), category `forms`. It has no props in v1 and only the `spacing` style group; it renders a `div` and is valid only inside a `buildr/form` (`requireAncestor`, never directly in a Loop). A form may hold at most one: a captcha belongs to its nearest form, and a second one makes the server answer `503` and the canvas show "A form can have only one verification." (the editor cannot enforce this yet). The server decides whether a captcha is required from the published form, not from the request ([payload.md](payload.md#captcha-pb-160d)).

Host config is `Platform.captcha?: { provider: 'turnstile'; siteKey: string; clickToLoad?: boolean }` ([renderer.md](renderer.md#platform), [nextjs.md](nextjs.md#captcha-pb-160d)). Absent means off. The site key is public and must match `^[A-Za-z0-9_-]{1,128}$`; anything else counts as absent. It is never stored in the document or manifest or passed through the editor or canvas protocol. The secret key is a server option and never reaches the page.

| Situation | Output |
|---|---|
| Canvas | A neutral hint: "The Turnstile check appears on the page, not in the editor." It never reads the platform, so it cannot say whether a key exists |
| No valid site key on a live page | The "unavailable" message; the server enforces the check regardless |
| Valid key, click-to-load on (default) | The consent notice and a "Load the check" button |
| Valid key, `clickToLoad: false` | The widget loads at mount, without the click |
| Preview (`env.mode === 'preview'`) | Always the notice and button, even when `clickToLoad` is false |
| No JavaScript | The notice and a `noscript` message "Enable JavaScript to submit this form."; the form cannot be submitted (fails closed) |

If the render has no layout reference or the browser has no `crypto.subtle`, the enhancer shows the "unavailable" status instead of loading. The consent notice is fixed catalog text, authors cannot change it: it says that loading Cloudflare Turnstile from `challenges.cloudflare.com` may set cookies and process the visitor's IP address and browser data (Polish copy in ADR-029). Nothing is requested from Cloudflare before the click, and nothing is remembered afterwards.

The enhancer (`captcha/enhancer.client.tsx`) injects `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once, as one `script[data-buildr-turnstile]` element with the states idle, loading, ready and failed (15 s load deadline; a failure can be retried with the button; a planted tag with that URL is replaced, not trusted). It copies the page's CSP nonce, the first non-empty `script[nonce]`, else `<meta name="csp-nonce">` ([security.md](security.md#captcha-turnstile)). It calls `window.turnstile` only after its own load event and only if `render` is a function. The widget is rendered into a child element the enhancer owns, with every parameter explicit:

| Parameter | Value |
|---|---|
| `sitekey` | `Platform.captcha.siteKey` |
| `action` | `buildr_form` |
| `cData` | SHA-256 (hex) of the JSON tuple `["buildr/captcha", 1, layoutRef, formNodeId]`; `formNodeId` comes from the form's `data-buildr-form`, `layoutRef` from the render environment |
| `response-field-name` | `buildr-captcha` (the reserved field name) |
| `size`, `theme`, `appearance` | `normal`, `auto`, `always` |
| `language` | `env.locale` when it looks like a language tag, else `auto` |

Accessibility: the button is `hidden` until hydration, is described by the notice (`aria-describedby`), is disabled while loading and disappears once the widget is ready. Pressing it moves focus to a polite `role="status"` region (`tabindex="-1"`), which then announces "Loading verification…", "Verification ready.", and the expiry, error and unavailable texts. The widget is reset after every submission (it listens for `buildr-form:settled` on its own form): a captcha failure or a network error asks the visitor to try again, and `503 captcha-unavailable` says the check is unavailable. The canvas never loads the provider: no script, no iframe, no preconnect. The type starts at version 1 without a migration. Hosts must update their CSP and privacy policy; see [security.md](security.md#captcha-turnstile).

### Input (`buildr/input`), Textarea (`buildr/textarea`), Select (`buildr/select`), Checkbox (`buildr/checkbox`)

Each renders one wrapper: a `label` tied to the control, an optional `hint` (wired with `aria-describedby`), a required marker (`*`, hidden from screen readers; the `required` attribute carries the meaning) and an empty error region. `name` is a static, non-bindable prop (letters, digits, `_`, `-`; starting with a letter; at most 64 characters; `_hp` and other reserved names are refused). All four are only valid inside a form (`requireAncestor`).

- **Input**: `type` is one of `text email tel url number date` (anything else falls back to `text`); `maxLength` (0 = no limit).
- **Textarea**: `rows` (2–30), `maxLength`.
- **Select**: `options` is a list of `{ label, value }`; entries without a value are skipped and an empty label shows the value. `placeholder` becomes an empty first choice, unselectable when the field is required. The values shown are exactly those the server accepts.
- **Checkbox**: label after the box (always visible), `defaultChecked`; a boolean field.

Field ids are derived from the node id, so they are stable between server and client rendering.

## The default registry

`createDefaultRegistry()` returns a `ReactRegistry` with every component (`defaultComponents`, 35) and every template (`defaultTemplates`, 14) of this package; `defaultTheme` is the theme they are designed against (the core default, re-exported), so an application needs one import. Extend it with `registry.extend({ components, templates })`: each call builds a new registry and nothing is shared or global.

```ts
import { createDefaultRegistry, defaultTheme } from '@next-buildr/components';
import '@next-buildr/components/styles.css';

const registry = createDefaultRegistry().extend({ components: [MyHero] });
```

The registry's manifest (`toManifest(registry.meta)`, what the editor loads) is kept under 72 KB (raised from 60 KB by PB-157: container background media, `buildr/video`, `buildr/iframe`); a test enforces it. Template thumbnails are therefore compact wireframes (one path per tone, a few hundred bytes), and templates keep their responsive overrides to what they need.

**The gallery.** `galleryEntries` lists every component in each of its states and every template and variant (`group: 'component' | 'template'`, `of`: the type or template id). Render an entry under a page with `createGalleryDataSource()` and `gallerySampleScopes`; review it at the widths of `FIXTURE_WIDTHS`. The test suite runs every entry through `validateDocument`, `runA11y` (no errors) and, server-rendered into jsdom, `vitest-axe` (colour contrast and page-level rules are switched off there: jsdom has no layout, and an entry is a fragment).

## Marketing templates

`marketingTemplates` (in `@next-buildr/components`) are ordinary `TemplateDefinition`s built only from the components above, with tablet and mobile overrides on the nodes that need them (see [templates.md](templates.md)). Each is a detached, fully editable copy once inserted. Each has an SVG wireframe `thumbnail` (a compact data URI drawn from plain shapes) and a gallery fixture in `marketingTemplateFixtures` (one per template and variant).

| Template | Id | Made of | Notes |
|---|---|---|---|
| Hero | `buildr/hero` | Container, Grid, Heading (H1), Text, Buttons, Image | `lock: structure`; the buttons are the editable `actions` region. Variants: default (picture first), `imageRight`, `centered` (no picture). Two columns, one on a phone. |
| Feature grid | `buildr/feature-grid` | Container, Grid, Icon, Heading, Text | Six features; three columns, two on tablet, one on mobile. |
| Call to action | `buildr/cta` | Container, Heading, Text, Button | On `$color.primary` with `$color.on-primary` text; `lock: structure` with an `actions` region. |
| Testimonial | `buildr/testimonial` | Container, Text | A quote and its author. |
| Pricing | `buildr/pricing` | Container, Grid, Card, Badge, List, Button | Three plans, one highlighted; stacked on tablet and mobile. |
| FAQ | `buildr/faq` | Container, Accordion | Four questions, the first open. |
| Contact | `buildr/contact` | Container, Grid, Form, Input, Textarea, Checkbox, Button | Name, email, message and a copy checkbox; the fields have static names so the server can derive the schema. |

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

Any component may declare `ComponentMeta.formField` (see [component-registry.md](component-registry.md)) to participate in form schema derivation. `deriveFormSchema(doc, registryMeta, formNodeId)` (in `@next-buildr/core/forms`) walks a `buildr/form` node's descendants and reads `formField` metadata generically — it never imports specific components — so custom form controls participate automatically. It returns `{ schema: { formId, fields: [{ nodeId, name, valueType, required, maxLength?, options? }] }, diagnostics }`. Only static prop values are read: a dynamic `name` or `options` is reported (`form.name-dynamic`, `form.options-dynamic`) and the field is left out, as are missing, invalid, reserved or duplicate names (`form.name-missing`, `form.name-invalid`, `form.name-duplicate`) and fields beyond the limit (`form.too-many-fields`). This function is the server-side source of truth for what a submitted form is allowed to contain; see [payload.md](payload.md) and [security.md](security.md).

### Spacer (`buildr/spacer`, version 1)

A decorative leaf (`div aria-hidden="true"`). `size` is xs, sm, md (default), lg, xl or 2xl and maps to theme space tokens 1, 2, 4, 8, 12 and 16 respectively; `axis` is vertical (default) or horizontal. Supports size and visibility styles.

### Anchor (`buildr/anchor`, version 1)

An empty span with an ID and a space-16 scroll margin. Canvas mode shows a `#name` pill; Spacer shows a hatched band with a minimum hit area. `name` is static, nonlocalizable, matches `^[a-z][a-z0-9-]{0,63}$`, and must not start with reserved `bc-`. Invalid or missing names render nothing on the site. For duplicate IDs, the first anchor wins for browser fragment navigation; no document validation rule deduplicates IDs.

### Fieldset (`buildr/fieldset`, version 1)

A form-only container with a default flow-content slot. Renders a native fieldset with its legend before the children. `legend` is bindable and localizable (default empty); `disabled` is bindable, defaults to false and disables descendant controls natively. It requires a `buildr/form` ancestor and replaces the old label palette slot.

PB-160a adds new version-1 types without migrations. Fixtures are registered for all three gallery widths. Docker visual baselines are refreshed in the same branch.

### Carousel (`buildr/carousel`, version 1)

| Prop | CMS contract / default |
|---|---|
| `ariaLabel` | Bindable, localizable accessible name; empty uses the localized fallback |
| `showArrows`, `showDots` | Show navigation controls; both true |
| `loop`, `autoplay` | Wrap navigation / automatic rotation; both false |
| `interval` | Bindable milliseconds, 3000–20000; 5000 |
| `slidesPerView` | Bindable integer, 1–4; 1 |

Bound `interval` and `slidesPerView` values outside their ranges are clamped, not rejected. The horizontal default slot accepts slides or a Loop of slides; default content is three slides. Without JavaScript it is a native scroll-snap track. At viewport widths of 480px or less it shows one slide per view (viewport based, not container based). The enhancer adds arrows, dots, Left/Right navigation outside interactive descendants, and inert off-screen slides. Autoplay is opt-in, never starts under `prefers-reduced-motion: reduce`, pauses on hover and focus, and has a visible pause/play control. Canvas shows the track without controls; selecting an off-screen slide does not scroll it into view in v1.

Deviation from the card: dots represent reachable scroll positions rather than one dot per slide. Slides are `insertable: false`: they are available through parent default content, duplication and parent templates; core rejects moving them individually, including into a Loop.

### CarouselSlide (`buildr/carousel-slide`, version 1)

No props. Its vertical default slot accepts flow content. Its parent must be Carousel or Loop, with a Carousel ancestor. It supplies slide group semantics and a localized slide description; the parent controls visibility and navigation.

### Gallery (`buildr/gallery`, version 1)

| Prop | CMS contract / default |
|---|---|
| `ariaLabel` | Bindable, localizable accessible name; empty uses the localized fallback |
| `columns` | Bindable integer, 2–6; 3 |
| `aspectRatio` | `1:1` (default), `4:3`, `3:2`, `16:9`, `auto` (original) |
| `lightbox` | Enable enhanced image preview; true |

A bound `columns` value outside 2–6 is clamped, not rejected. The column count also drops to 2 below 480px and to 1 below 320px of the gallery's own width (a container query, unlike the viewport-based Carousel breakpoint), whatever `columns` says. The default slot accepts gallery items or a Loop of items; default content is three items. ARIA list semantics accommodate Loop wrappers. Links work without JavaScript. The optional lightbox uses a native `<dialog>` with focus entry/return, Escape to close, Left/Right navigation and an image counter; only relative, http and https image URLs open it. External images use `referrerPolicy="no-referrer"` and links use `rel="noreferrer"`. Sites with a Content Security Policy must allow image hosts in `img-src`.

Items are `insertable: false`: they are available through parent default content, duplication and parent templates; core rejects moving them individually, including into a Loop.

### GalleryItem (`buildr/gallery-item`, version 1)

| Prop | CMS contract / default |
|---|---|
| `image` | Bindable image media reference; unset |
| `alt` | Bindable, localizable alternative text; empty falls back to media alt |
| `caption` | Bindable, localizable figure caption; empty |

A leaf with no slots, parent Gallery or Loop and a required Gallery ancestor. A Loop-bound image needs a stored media snapshot; otherwise the item renders empty with a `render.media-missing` warning. Deviation from the card's linked-figure description: an empty item renders an unlinked placeholder. A populated item links its image inside a figure; the link name falls back from alt to caption to localized "Open image". All four PB-160b types start at version 1 without migrations.
