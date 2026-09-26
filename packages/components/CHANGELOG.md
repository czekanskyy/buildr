# @next-buildr/components

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
