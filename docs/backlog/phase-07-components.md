# Phase 7: Components

## PB-050 - Component library scaffold - M

- **Purpose**: conventions and tooling shared by every component.
- **Dependencies**: PB-044, PB-028
- **Files**: `packages/components/src/{index.ts,styles/base.css,icons/*}`, `scripts/gen-component.mjs`, `docs/ai/component-development.md` (extended)
- **Implementation**: the component directory structure (`definition.ts`, `view.tsx`/`view.client.tsx`, `styles.css`, `fixtures.ts`, `*.test.tsx`); a minimal reset in `buildr.reset`; roughly 80 icons (lucide SVG paths, ISC license notice included); a `pnpm gen:component <name>` generator; a convention test (`runtime: 'client'` implies a `*.client.tsx` file).
- **Tests**: the convention test; the generator produces a component that compiles.
- **Acceptance criteria**: a step-by-step guide exists in `component-development.md`.
- **Risks**: none.

## PB-051 - Page, Section, Container - M

- **Purpose**: page structure.
- **Dependencies**: PB-050
- **Files**: `packages/components/src/{page,section,container}/`
- **Implementation**: Page (the root, not insertable); Section (`as`, `container` width, a bindable `backgroundImage` MediaRef, `ariaLabel`, landmark role); Container (a token-based max-width).
- **Tests**: per the component Definition of Done.
- **Acceptance criteria**: gallery fixtures at all three breakpoints.
- **Risks**: none.

## PB-052 - Stack, Grid - M

- **Purpose**: flex and grid layout.
- **Dependencies**: PB-050
- **Files**: `packages/components/src/{stack,grid}/`
- **Implementation**: Stack (flex, `role` from an allowlist: `none|group|list`); Grid (`layout.columns` styles, a `columnSpan` on children); the layout axis for drag-and-drop.
- **Tests**: per the DoD; responsive column overrides.
- **Acceptance criteria**: responsive fixtures.
- **Risks**: none.

## PB-053 - Heading, Text - M

- **Purpose**: text with inline editing support.
- **Dependencies**: PB-050
- **Files**: `packages/components/src/{heading,text}/`
- **Implementation**: Heading (`level`, `inlineProp`), Text (`as`, `inlineProp`), both bindable.
- **Tests**: per the DoD; bindings; semantics independent of appearance.
- **Acceptance criteria**: `editor.inlineProp` is set.
- **Risks**: none.

## PB-054 - RichText - S

- **Purpose**: formatted content.
- **Dependencies**: PB-050, PB-048
- **Files**: `packages/components/src/rich-text/`
- **Implementation**: `content: p.richText({ bindable })`; content typography lives in the component's own CSS (`.bc-rich-text :where(h2, p, ul)`).
- **Tests**: per the DoD; a rich text binding.
- **Acceptance criteria**: enables the PostContent template.
- **Risks**: none.

## PB-055 - Button, Link - M

- **Purpose**: actions and navigation.
- **Dependencies**: PB-050
- **Files**: `packages/components/src/{button,link}/`
- **Implementation**: Button (`label`, `href` -> `platform.Link`, or `type: button|submit`, `variant`, `size`, `icon`, `iconPosition`, `ariaLabel`, `newTab`); Link (text + `href`, `newTab` with hidden text); the `Platform.Link` contract.
- **Tests**: per the DoD; URL sanitization; an accessible name for icon-only buttons; `#interactive` content-model checks.
- **Acceptance criteria**: works with both the default platform (`<a>`) and Next.js (PB-103).
- **Risks**: none.

## PB-056 - Image - M

- **Purpose**: static and dynamic images (see `docs/payload.md`).
- **Dependencies**: PB-050, PB-026
- **Files**: `packages/components/src/image/`
- **Implementation**: `image` (a bindable MediaRef), `alt` (defaulting from the media asset), `decorative`, `sizes` (presets), `fit`, `priority`, focal point -> `object-position`; `platform.Image` with an `<img srcset>` fallback; an empty-state placeholder (canvas only).
- **Tests**: per the DoD; static/media-derived/decorative `alt`; srcset from `sizes`.
- **Acceptance criteria**: the `image-alt` rule applies correctly to this component.
- **Risks**: none.

## PB-057 - Icon, List/ListItem, Divider, Badge - M

- **Purpose**: small content elements.
- **Dependencies**: PB-050
- **Files**: `packages/components/src/{icon,list,list-item,divider,badge}/`
- **Implementation**: Icon (decorative by default, `label` -> `role=img`); List (`ordered`, a slot accepting only `buildr/list-item`, 3 default items); Divider (`<hr>`); Badge (`variant`).
- **Tests**: per the DoD; `list-structure`.
- **Acceptance criteria**: icons render server-side with no JS.
- **Risks**: none.

## PB-058 - Card - M

- **Purpose**: a card with multiple regions.
- **Dependencies**: PB-050
- **Files**: `packages/components/src/card/`
- **Implementation**: `media`, `body`, `actions` slots; `href` renders as a stretched link (a pseudo-element covering the title, with no nested interactive elements); `variant`; `as` (`article|div`).
- **Tests**: per the DoD; no `nested-interactive` violation when `href` plus a Button in `actions` coexist (the Button sits above the link layer).
- **Acceptance criteria**: the whole card is clickable and accessible.
- **Risks**: stretched-link vs. button conflicts, resolved via CSS `z-index` and a dedicated test.

## PB-059 - Accordion - M

- **Purpose**: FAQ sections.
- **Dependencies**: PB-050
- **Files**: `packages/components/src/{accordion,accordion-item}/`
- **Implementation**: native `<details>/<summary>`; `allowMultiple=false` maps to a shared `name` attribute; AccordionItem (a bindable `summary`, a content slot, `defaultOpen`); `editor.revealOnSelect`.
- **Tests**: per the DoD; keyboard behavior; `accordion-structure`.
- **Acceptance criteria**: works with no JavaScript.
- **Risks**: older browsers without `name`-on-`details` support degrade to independent panels (an acceptable trade-off).

## PB-060 - Loop, Pagination - M

- **Purpose**: listings (see `docs/dynamic-bindings.md`).
- **Dependencies**: PB-046, PB-050
- **Files**: `packages/components/src/{loop,pagination}/`
- **Implementation**: Loop (`source: p.listSource()`, `as`, `item`/`empty`/`after` slots, layout via grid/stack styles); Pagination (bindable `page`, `totalPages`, an `hrefPattern` with `{page}`, a `nav` with `aria-label`, `aria-current`).
- **Tests**: per the DoD; Loop against `MemoryDataSource`; Pagination edge cases (bounds, a single page).
- **Acceptance criteria**: enables the BlogListing template.
- **Risks**: none.

## PB-061 - Forms: Form, Input, Textarea, Select, Checkbox - L

- **Purpose**: a page with a form (MVP scenario 6).
- **Dependencies**: PB-050
- **Files**: `packages/components/src/{form,input,textarea,select,checkbox}/`, `packages/core/src/forms/derive-form-schema.ts` (a deliberate exception: a generic core function)
- **Implementation**: Form (`runtime: client` view: progressive enhancement, fetch, a live region; `action` via `platform.formAction(layoutRef, nodeId)`, `successMessage`, a honeypot field); fields: `label` (required), `name` (unique within the form, validated), `required`, `maxLength`, `hint`, `hideLabel`, `placeholder`, Select `options`; `formField` metadata; `#form-control` plus `requireAncestor: buildr/form`; `deriveFormSchema(doc, registryMeta, formNodeId)` works generically off `formField` metadata, so custom controls participate automatically.
- **Tests**: per the DoD; `name` uniqueness validation; label/error accessibility; a no-JS submission (a plain POST); `deriveFormSchema` against a fixture form.
- **Acceptance criteria**: the form schema is derivable without importing any component code, and is used by PB-102.
- **Risks**: logic living in a client component is limited to progressive enhancement (no business validation logic there).

## PB-062 - Marketing templates - L

- **Purpose**: MVP scenarios 1-2 and 6.
- **Dependencies**: PB-018, PB-051 through PB-059, PB-061
- **Files**: `packages/components/src/templates/{hero,cta,feature-grid,testimonial,pricing,faq,contact}.ts`, SVG thumbnails
- **Implementation**: trees with tablet/mobile overrides, regions (`actions`), Hero variants (`imageRight`, `centered`).
- **Tests**: instantiation; `validateDocument` and `runA11y` report zero errors; gallery fixtures at all three breakpoints.
- **Acceptance criteria**: every template looks correct at all three breakpoints (a screenshot review).
- **Risks**: visual quality is an adoption risk — a design review is required.

## PB-063 - Blog and product templates - M

- **Purpose**: MVP scenarios 3-5.
- **Dependencies**: PB-062, PB-060
- **Files**: `packages/components/src/templates/{post-header,post-card,blog-listing,author-box,post-content,product-hero,product-details}.ts`
- **Implementation**: bindings to `post.*`/`product.*`/`item.*`/`loop.*`, date and price formatting, a Loop over `product.images` and `product.attributes`.
- **Tests**: rendering against `MemoryDataSource` (sample data), zero accessibility errors.
- **Acceptance criteria**: work correctly in the playground against sample data.
- **Risks**: none.

## PB-064 - The default registry, theme, aggregate tests - M

- **Purpose**: a ready-made set for applications to consume.
- **Dependencies**: PB-051 through PB-063, PB-042
- **Files**: `packages/components/src/{registry,theme}.ts`
- **Implementation**: `defaultComponents`, `defaultTemplates`, `createDefaultRegistry()`, `defaultTheme`.
- **Tests**: every component and template appears in the gallery; `vitest-axe` against the SSR'd gallery; `runA11y` against every template.
- **Acceptance criteria**: the default registry's manifest is under 60 KB.
- **Risks**: none.
