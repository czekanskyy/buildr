# @next-buildr/components

## 3.0.0

### Minor Changes

- c2144e8: PB-157: `buildr/container` now supports the `typography` style group, so the editor shows its Typography and Colours sections (inherited text colour and type settings for children).
- c2144e8: PB-157: `buildr/heading` gets an optional `tag` prop (`heading` by default, or `p`, `span`, `div`,
  `strong`) to render heading-styled text outside the outline. The `heading-order` and `empty-heading`
  a11y rules skip a heading that does not render as a heading. Component version 2 (identity migration).
- c2144e8: PB-157 (ADR-028): `buildr/container` (version 3, identity migration) gets background video with a
  poster, an overlay (`overlayTone`, `overlayOpacity`, `backgroundOverlay`), and `backgroundFit`,
  `backgroundPosition` and `backgroundAttachment`. The background is decorative (`aria-hidden`), the
  video is muted and looping, and reduced motion shows the still and unfixes the background. New
  components `buildr/video` and `buildr/iframe` (https only, sandboxed with `allow-scripts`, no
  referrer, lazy, a required title). A media prop may hold an external source,
  `{ external: true, url }`, which `buildr/image`, `buildr/video` and the container background render
  only when the URL is https, free of credentials and allowed by the host. `HostCapabilities` in
  `@next-buildr/core` gets the optional `externalMediaHosts` and `iframeHosts` allowlists (a host and
  its subdomains; absent means any https host, `[]` none). The default manifest budget is now 72 KB.
- c2144e8: PB-157 (ADR-026, ADR-027): `buildr/text` gets `mode` (`plain` by default, `rich`, `html`) with the
  props `rich` (rich text) and `html` (author HTML). `plain` is the old behaviour; `rich` and `html`
  render a `div`. `html` renders core's sanitised tree through `createElement` (no
  `dangerouslySetInnerHTML`) and only when the host's `authorCode` capability is on; otherwise it shows
  the plain `text`. Component version 2 (identity migration: a stored text has no `mode`, which already
  means plain). Every component that had `effects` except the form controls now also has the `motion`
  style group.
- 5b49a14: PB-160a: three new blocks. `buildr/spacer` (vertical or horizontal gap, theme space tokens, hidden
  from assistive technology), `buildr/anchor` (an empty `<span id>` link target; the name must match
  `^[a-z][a-z0-9-]{0,63}$` and may not start with `bc-`, an invalid name renders nothing on the site,
  the first of duplicate ids wins) and `buildr/fieldset` (`<fieldset><legend>`, only inside a form).
  All three start at version 1, so no migration is needed. The editor knows their Polish labels and
  icons, and the Formularze section of the Blocks tab lists Fieldset in place of the old "Etykieta"
  slot.
- e88ba0f: PB-160b: four new blocks. `buildr/carousel` provides a scroll-snap track with optional
  controls and opt-in autoplay (off by default, never under reduced motion, with a pause
  control), and `buildr/carousel-slide` holds its content. `buildr/gallery` provides an
  image grid, aspect ratios and an optional native-dialog lightbox; `buildr/gallery-item`
  holds each image and caption. All four start at version 1, so no migration is needed.
  The editor knows their Polish labels, and the media section of the Blocks tab lists
  Carousel and Gallery. Slides and items cannot be inserted or moved individually
  in the palette (`insertable: false`).
- 13e16e8: PB-160c: `buildr/map` uses the Google Maps Embed API in place mode, with
  click-to-load on by default: no provider request before the consent click, and
  the canvas never loads a provider. Without a valid key, or when the frame host
  is not allowed by `iframeHosts`, it renders only a link. Requires `Platform.maps`
  (the react/next minor releases in `pb-160c-platform-maps.md`). Starts at version 1,
  so no migration is needed. The editor knows its Polish label and lists Map in
  the media section of the Blocks tab.

### Patch Changes

- c2144e8: PB-157 security review fixes (ADR-026, ADR-028). Custom CSS: `(` and `[` share one bracket stack, as in the CSS Syntax spec, so `[(])` and `([)]` are refused instead of swallowing later rules, and a `:` that is not a pseudo-class is refused in a selector. Media: `@next-buildr/react` exports `markResolvedMedia` and `isResolvedMedia`; the renderer marks only the assets it resolved from `PreparedData.media`, and the media components treat every other object with a `url` (a raw value, or the snapshot of an unprepared reference) like an external source (https and the host allowlist) or a same-origin `/path`. A present `externalMediaHosts` or `iframeHosts` that is not an array now allows no host. `buildr/video` no longer sets `referrerPolicy`, which a `video` element does not have; hosts using external video should send a page-level `Referrer-Policy`. Payload: without a `registry`, a request that may not write author code cannot add or change an `html` prop or `mode: 'html'`, `authorCode` other than `false` needs the `registry` option, and a duplicate no longer carries the source document's author code to a request that may not write it.
- Updated dependencies [e72f26a]
- Updated dependencies [c2144e8]
- Updated dependencies [c2144e8]
- Updated dependencies [c2144e8]
- Updated dependencies [c2144e8]
- Updated dependencies [c2144e8]
- Updated dependencies [c2144e8]
- Updated dependencies [c2144e8]
- Updated dependencies [c2144e8]
- Updated dependencies [c2144e8]
- Updated dependencies [1d27dd7]
  - @next-buildr/react@3.0.0
  - @next-buildr/core@3.0.0

## 2.0.1

### Patch Changes

- bf086e5: Add package license metadata and npm landing-page READMEs.
- Updated dependencies [bf086e5]
  - @next-buildr/core@2.0.1
  - @next-buildr/react@2.0.1

## 2.0.0

### Major Changes

- aaa5701: `buildr/container` is now version 2 and absorbs the layout options of `buildr/stack` and `buildr/section`.

  New props: `display` (`flex` by default, `block` shown as "Box", `grid`, `inline-flex`, `inline-block`), `as` (the element, `div` by default, or a landmark such as `section`, `header`, `main`, `nav`), `width` (adds `none`, "No limit"), `bleed` (a full-width background with the content kept to the column), `backgroundImage`, `role` and `ariaLabel`. It is now a landmark container (`contentCategories` gains `landmark`), its slot axis follows the computed layout, and it has the `size` style group.

  Stored containers are migrated to `display: 'block'`, so they look as before. Stored `buildr/stack` and `buildr/section` nodes are rewritten into containers when a document is loaded (`replaces`, ADR-025):

  - a stack becomes a flex column with no width limit, keeping its role and accessible name;
  - a section becomes a `bleed` flex column with its element, width (`full` becomes `none`), background image (static or bound) and accessible name, and gets `gap: 0` where it had no gap, so spacing does not change. A section used to create a stacking context even without an image; a bleeding container does the same.

  Removed exports: `Section`, `Stack`, `sectionFixtures`, `stackFixtures`, `SECTION_CONTAINERS`, `SECTION_ELEMENTS` and `STACK_ROLES`; the library registry no longer registers `buildr/section` or `buildr/stack`, and the built-in templates now use containers. Use `Container` (and `CONTAINER_DISPLAYS`, `CONTAINER_ELEMENTS`, `CONTAINER_ROLES`, `CONTAINER_WIDTHS`) instead. Stored documents are migrated, but a registry built without the library's `Container` cannot read them.

  Containers now match the `landmark` content category (a container can sit where only landmarks were allowed), so a container can sit where only landmarks were allowed. The migration is one-way: save, publish and template hooks persist the migrated document, and an older build opens it read-only. Keep Payload versions enabled so a pre-migration revision can be restored.

### Patch Changes

- Updated dependencies [aaa5701]
- Updated dependencies [aaa5701]
  - @next-buildr/core@2.0.0
  - @next-buildr/react@2.0.0

## 1.0.0

### Minor Changes

- bc6f942: Add the Loop and Pagination components (PB-060), and the pagination messages: Loop repeats a template over a query or a list; Pagination renders crawlable page links with bounds handling.
- 3d59397: Add the component library scaffold (PB-050): `<Icon>` with about 90 lucide icons (`ICON_NAMES`, `ICON_NODES`, `hasIcon`), a minimal reset in `@layer buildr.reset` scoped to `.bc-page`, and the `pnpm gen:component` generator.
- 96db603: Adds the blog and product templates PostHeader, PostContent, AuthorBox, PostCard, BlogListing, ProductHero and ProductDetails as `contentTemplates`, with sample data (PB-063).
- 4956ed7: Adds `createDefaultRegistry()`, `defaultComponents`, `defaultTemplates`, `defaultTheme` and the gallery (`galleryEntries`, `createGalleryDataSource`, `gallerySampleScopes`); every entry is checked with `vitest-axe`. The manifest of the default registry is under 60 KB (PB-064).
- d145516: Adds Form, Input, Textarea, Select and Checkbox, with a honeypot, server-driven field errors and a progressive `fetch` enhancement (PB-061).
- b8d8ca4: Adds the marketing templates Hero (with `imageRight` and `centered` variants), FeatureGrid, Cta, Testimonial, Pricing, Faq and Contact as `marketingTemplates`, with SVG thumbnails and `marketingTemplateFixtures` (PB-062).
- cf5a362: Add the Button and Link components (PB-055) and the built-in message catalog (`BUILT_IN_MESSAGES`, `message`): links go through the platform's `Link`, unsafe URLs never become an `href`, and a new-tab link is announced.
- 81555b9: Add the Heading and Text components with fixtures (PB-053): a heading level is the outline level and independent of its look; both have bindable text and inline editing.
- af171de: Add the Icon, List, ListItem, Divider and Badge components (PB-057): icons render server-side without JavaScript, and lists accept only list items.
- bee7b9f: Add the RichText component (PB-054): renders a bindable rich text value through `renderRichText`, with its own scoped content typography.
- f3c5e66: Give every built-in component a distinct lucide `meta.icon` (PB-121). Presentation metadata only: the manifest hash changes, the document shape does not, no migration.
- b85ff70: Add the editor icon system (PB-120): `Icon`, `ComponentIcon` and `componentIconNames` are exported from `@next-buildr/editor`, and `IconButton` now takes an icon name (`IconName`) instead of a glyph. Component icons resolve against a curated static map of lucide icons (unknown or missing names show a neutral box); the undo/redo, back, tree, select, layer-badge and list-control glyphs are now icons. New dependency: `lucide-react` (tree-shakeable, ISC; the same icon set the components package draws from). `@next-buildr/components`: the Textarea icon is the canonical lucide name `text-align-start` (was the alias `align-left`).
- 87c023c: Add the Page, Section and Container components with their fixtures (PB-051), exported from `@next-buildr/components` together with `ComponentFixture` and `FIXTURE_WIDTHS`; their styles are part of `styles.css`.
- e400727: Add the Stack and Grid components with responsive fixtures (PB-052); layout direction, gap, columns and spans are style properties, so they change per breakpoint.
- 0d146d4: Add the Image component (PB-056): media-derived, author-set or decorative alternative text, `srcset` from the generated sizes, display-width presets, fit, focal point and priority, through the platform's `Image`.
- 9504f2a: The 0.1.0 MVP release: the document model, the renderer, the standard components and templates, the visual editor, and the Next.js and Payload integrations, with the reference application and its end-to-end tests.
- 1453d2e: Add the Accordion and AccordionItem components (PB-059), built on native `<details>`: no JavaScript, with an optional exclusive mode.
- 0783205: Add the Card component (PB-058): media, body and actions slots, variants, and a stretched link that keeps buttons in the actions clickable without nesting interactive elements.

### Patch Changes

- 1ba33ad: Rename the npm scope from @buildr to @next-buildr
- Updated dependencies [4bdbb99]
- Updated dependencies [82bdd80]
- Updated dependencies [037287f]
- Updated dependencies [1190b2c]
- Updated dependencies [29589ff]
- Updated dependencies [71575c7]
- Updated dependencies [d145516]
- Updated dependencies [db7cd10]
- Updated dependencies [b15291b]
- Updated dependencies [96db603]
- Updated dependencies [e158655]
- Updated dependencies [89f165d]
- Updated dependencies [61f56e7]
- Updated dependencies [c10493a]
- Updated dependencies [d761eef]
- Updated dependencies [ee256d5]
- Updated dependencies [037be06]
- Updated dependencies [c507cb0]
- Updated dependencies [c18c6ad]
- Updated dependencies [4beb4f2]
- Updated dependencies [b2bb3ed]
- Updated dependencies [d5e8202]
- Updated dependencies [5e09ff6]
- Updated dependencies [f238e41]
- Updated dependencies [0533292]
- Updated dependencies [890b443]
- Updated dependencies [a573b16]
- Updated dependencies [0a9cf21]
- Updated dependencies [9608646]
- Updated dependencies [a23e2d8]
- Updated dependencies [180b576]
- Updated dependencies [e8ac326]
- Updated dependencies [1575afe]
- Updated dependencies [55befc3]
- Updated dependencies [e5c2180]
- Updated dependencies [0af8fef]
- Updated dependencies [8ab4fbe]
- Updated dependencies [7894e77]
- Updated dependencies [d145516]
- Updated dependencies [1453d2e]
- Updated dependencies [d4b20af]
- Updated dependencies [9504f2a]
- Updated dependencies [1ba33ad]
- Updated dependencies [5a69090]
- Updated dependencies [27a98e1]
- Updated dependencies [6021ce8]
- Updated dependencies [bbd0e13]
- Updated dependencies [98682f1]
- Updated dependencies [89cadd5]
- Updated dependencies [3ec3fce]
- Updated dependencies [b3fa4e1]
- Updated dependencies [6d61340]
- Updated dependencies [00075b9]
- Updated dependencies [8927bba]
- Updated dependencies [2402292]
- Updated dependencies [b466583]
- Updated dependencies [d1a8c6f]
- Updated dependencies [024fc96]
  - @next-buildr/core@1.0.0
  - @next-buildr/react@1.0.0
