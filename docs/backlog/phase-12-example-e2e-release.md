# Phase 12: The example app, end-to-end tests, and the 0.1.0 release

## PB-108 - Example app scaffold - L

- **Purpose**: the reference integration, and the target for end-to-end tests.
- **Dependencies**: PB-093
- **Files**: `apps/example-next-payload/**`
- **Implementation**: Next.js 16 plus Payload 3 (Postgres by default, SQLite via an environment variable in CI), localization configured for `pl` (default) plus `en` with `localized` fields per `docs/payload.md`, the collections and globals from `docs/payload.md`, the SEO plugin, roles, `buildr.registry.ts`/`buildr.server.ts`, a `pnpm seed` script.
- **Tests**: `next build` succeeds; the admin UI loads.
- **Acceptance criteria**: `pnpm dev:example` works after `pnpm i`.
- **Risks**: Payload plus Next.js configuration friction — mitigated by pinned versions.

## PB-109 - Frontend routes - M

- **Purpose**: the public pages (see `docs/nextjs.md`).
- **Dependencies**: PB-108, PB-103, PB-101, PB-107, PB-117
- **Files**: `apps/example-next-payload/src/app/(frontend)/**`, `src/middleware.ts`
- **Implementation**: `[locale]`-scoped routes: pages, blog (listing plus pagination), post, product; `generateMetadata` (hreflang), `generateStaticParams` per locale, the locale middleware, `error`/`not-found`.
- **Tests**: end-to-end coverage in PB-112.
- **Acceptance criteria**: pages render correctly from seed content.
- **Risks**: none.

## PB-110 - Builder, canvas and preview routes; the "Edit with Visual Builder" flow - M

- **Purpose**: the complete intended workflow (Payload -> "Edit with Visual Builder" -> a separate tab -> edit -> save -> preview -> publish).
- **Dependencies**: PB-108, PB-104, PB-105, PB-106, PB-100, PB-115, PB-116
- **Files**: `apps/example-next-payload/src/app/{(builder),(frontend)/buildr}/**`, `next.config.ts`
- **Implementation**: the route files, the client-side files (a canvas file importing the registry, an editor file importing the adapter), security headers, plugin `routes` configuration.
- **Tests**: a manual smoke pass plus the end-to-end suite in PB-112.
- **Acceptance criteria**: the full flow — Payload, button, new tab, edit, save, preview, publish — works.
- **Risks**: none.

## PB-111 - Seeds for the six scenarios - M

- **Purpose**: demo and test data.
- **Dependencies**: PB-109, PB-064
- **Files**: `apps/example-next-payload/src/seed/**`
- **Implementation**: documents built from templates (a landing page, a company page, a blog post plus its template, a listing, a product plus its template, a contact page) with `en` translations in `l10n`, content (posts, authors, categories, products, media) in both `pl` and `en`.
- **Tests**: a test asserting `validateDocument` and `runA11y` report zero errors on every seed.
- **Acceptance criteria**: seeding is idempotent.
- **Risks**: none.

## PB-112 - MVP end-to-end tests - L

- **Purpose**: proof that the MVP actually works (see `docs/roadmap.md`).
- **Dependencies**: PB-110, PB-111
- **Files**: `apps/example-next-payload/e2e/**`, the `e2e` CI job
- **Implementation**: Playwright covering: the six scenarios' public rendering in both `pl` and `en`; editor flows (insert, inline edit, a mobile-only style, a binding, switching languages and translating a heading so that `/en/...` shows the translation, autosave, reload, undo/redo, publish -> the live public page); hreflang correctness; zero builder JS on a static page; axe checks.
- **Tests**: (this task *is* the test suite)
- **Acceptance criteria**: stable — zero flakes across 20 consecutive runs.
- **Risks**: iframe-related flakiness — mitigated by waiting on explicit protocol states (e.g. `canvas:ready`) rather than timeouts.

## PB-113 - Visual regression and accessibility checks - M

- **Purpose**: protecting appearance and accessibility over time.
- **Dependencies**: PB-049, PB-111
- **Files**: `apps/playground/e2e/visual/**`, the `visual` workflow
- **Implementation**: gallery screenshots (3 breakpoints) captured via the Playwright Docker image, axe against the gallery and the example pages.
- **Tests**: (this task *is* the test suite)
- **Acceptance criteria**: an approved baseline exists; updates require the `visual` label.
- **Risks**: font-rendering differences across environments — mitigated by using only the Docker image for screenshots.

## PB-114 - Final documentation and the 0.1.0 release - M

- **Purpose**: shipping the MVP.
- **Dependencies**: PB-112, PB-113, PB-005
- **Files**: `docs/{getting-started,payload,nextjs,components}.md`, `README.md`, `.changeset/*`
- **Implementation**: verifying getting-started end to end, a quickstart in `README.md`, a 0.1.0 changeset, publishing.
- **Tests**: someone outside the immediate team (a person or an agent) successfully follows getting-started.
- **Acceptance criteria**: the MVP exit criteria in `docs/roadmap.md` are all met.
- **Risks**: none.
