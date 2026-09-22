# Phase 11: The Next.js integration

## PB-103 - `BuildrPage` and the Next platform - L

- **Purpose**: production rendering under the App Router (see `docs/nextjs.md`).
- **Dependencies**: PB-047, PB-055, PB-056
- **Files**: `packages/next/src/{config,page,platform,section-boundary,metadata}.tsx`
- **Implementation**: `createBuildrConfig`, `BuildrPage` (an async RSC), `createNextPlatform` (Link, Image, formAction), `BuildrSectionBoundary`, `buildrMetadata` (a generic SEO shape).
- **Tests**: rendering under the `react-server` condition (Vitest); end-to-end coverage in PB-112.
- **Acceptance criteria**: a page with no client components ships no builder JS (verified in E2E).
- **Risks**: Next.js API differences between 15.x and 16.x — covered by the nightly matrix.

## PB-104 - Draft mode and preview - M

- **Purpose**: previewing draft content (see `docs/nextjs.md`).
- **Dependencies**: PB-103
- **Files**: `packages/next/src/draft/{route,exit-route,banner}.tsx`
- **Implementation**: a route handler with an `authorize` callback, `draftMode().enable()`, redirects restricted to relative paths only, an exit action, `PreviewBanner`.
- **Tests**: unit tests (rejecting an absolute-URL redirect, 401 for an unauthenticated request).
- **Acceptance criteria**: no open-redirect vector exists.
- **Risks**: none.

## PB-105 - The canvas route - M

- **Purpose**: hosting the canvas inside the Next.js app (see `docs/nextjs.md`).
- **Dependencies**: PB-067, PB-103
- **Files**: `packages/next/src/canvas/{page,headers}.tsx`
- **Implementation**: `BuildrCanvasPage` (a wrapper: `authorize`, `noindex`, dynamic rendering), `buildrSecurityHeaders()` for `next.config`, documentation for the client-side registry-importing file the consuming app must provide.
- **Tests**: E2E (PB-112): the canvas is unreachable while unauthenticated; correct CSP headers.
- **Acceptance criteria**: the canvas inherits the site's own layout.
- **Risks**: none.

## PB-106 - The editor route - M

- **Purpose**: the editor as its own route (see ADR-019).
- **Dependencies**: PB-076, PB-087
- **Files**: `packages/next/src/editor/page.tsx`
- **Implementation**: `BuildrEditorPage` (a login redirect, a server-computed manifest, client-facing props), a separate root layout with no site chrome.
- **Tests**: E2E coverage in PB-112.
- **Acceptance criteria**: the editor's JS bundle loads only on this route.
- **Risks**: none.

## PB-107 - Cache tags, revalidation, `getBuildrDocument` - M

- **Purpose**: an efficient production path (see `docs/payload.md`, `docs/nextjs.md`).
- **Dependencies**: PB-103, PB-095, PB-101
- **Files**: `packages/payload/src/next/{get-document,tags,revalidate,seo}.ts`
- **Implementation**: `getBuildrDocument({ collection, slug|id, draft })` (Local API plus `resolveLayout` plus `buildContext` plus tags; caching applies only to published reads), `listPublishedSlugs`, `revalidateHooks()`, mapping Payload's own SEO fields onto `buildrMetadata`.
- **Tests**: unit tests for tag correctness; E2E: publishing revalidates the page.
- **Acceptance criteria**: the tag convention is documented in `docs/nextjs.md`.
- **Risks**: Next.js caching-model churn — isolated to this one module.

## PB-117 - Next.js: routing and rendering per locale - M

- **Purpose**: multilingual public pages (see `docs/i18n.md`, `docs/nextjs.md`).
- **Dependencies**: PB-103, PB-107, PB-116
- **Files**: `packages/next/src/{i18n,metadata}.ts`, `packages/payload/src/next/get-document.ts`
- **Implementation**: a `locale` parameter flowing into `BuildrPage` (feeding `DataContext` and `env.messages`); `getBuildrDocument({ locale })` with locale-keyed caching; a `generateLocaleStaticParams` helper; `alternates.languages` (hreflang) in `buildrMetadata`; `createLocaleMiddleware({ locales, default })` (Accept-Language negotiation, avoiding cookies on the cached path); a locale-aware preview route.
- **Tests**: unit tests (hreflang, params); end-to-end coverage in PB-112.
- **Acceptance criteria**: every page carries a correct `<html lang>` and correct hreflang tags.
- **Risks**: middleware interacting with caching — mitigated by only redirecting the bare `/` path.
