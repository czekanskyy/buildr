# Next.js integration

See also [ADR-011](adr/ADR-011-nextjs-integration.md).

## Application API and configuration

```ts
// buildr.registry.ts — universal (imported by both the server and the canvas client)
export const registry = createRegistry({ components: [...defaultComponents, ...custom], templates: [...defaultTemplates] });
export const theme = defaultTheme;

// buildr.server.ts — server only
export const buildr = createBuildrConfig({
  registry, theme,
  platform: createNextPlatform(),                         // next/link, next/image, formAction
  dataSource: async () => new PayloadDataSource({ payload: await getPayload({ config }) }),
  onError: (e) => console.error(e),
});

// app/(frontend)/[locale]/[[...slug]]/page.tsx
export default async function Page({ params }: PageProps) {
  const { locale, slug } = await params;
  const { isEnabled: draft } = await draftMode();
  const entry = await getBuildrDocument({ collection: 'pages', slug: slug?.join('/') ?? 'home', locale, draft });
  if (!entry) notFound();
  return <BuildrPage config={buildr} entry={entry} locale={locale} />;    // async RSC
}
export async function generateMetadata({ params }: PageProps) { return buildrMetadata(await getEntry(params), { siteName }); }
export async function generateStaticParams() { return generateLocaleStaticParams('pages'); }
```

## Application routes

```
app/
  (frontend)/[locale]/layout.tsx                      # site layout (fonts, global CSS, header/footer, <html lang>)
  (frontend)/[locale]/[[...slug]]/page.tsx            # Pages
  (frontend)/[locale]/blog/[slug]/page.tsx            # Post (own layout | template)
  (frontend)/[locale]/blog/page/[page]/page.tsx       # listing ("blog" page with Loop + Pagination, route.params.page)
  (frontend)/[locale]/products/[slug]/page.tsx        # Product
  (frontend)/buildr/canvas/page.tsx                   # canvas (site layout; locale comes from the protocol -> full fidelity)
  (frontend)/buildr/preview/route.ts                  # draft mode + redirect (locale-aware)
  middleware.ts                                       # redirects / to /{defaultLocale} (Accept-Language negotiation)
  (builder)/buildr/edit/[collection]/[id]/page.tsx    # editor (its own root layout, no site chrome)
  (payload)/admin/..., (payload)/api/...              # Payload
```

The `/buildr/*` prefix does not collide with Payload's own catch-all `/api/*`, or with App Router private folders (`_*`).

## Server Components, client boundaries, dynamic routes

- `BuildrPage` is an async Server Component: migrate -> `prepareRender` (Local API) -> `compileStyles` -> `renderTree`. Only the JavaScript for `runtime: 'client'` components actually used on the page reaches the client. **Goal: a page with no interactive components ships zero builder JS.**
- The canvas and editor pages are server wrappers from `@buildr/next/canvas|editor` (auth, headers, `noindex`, a server-computed manifest) plus a small client file in the consuming application (`'use client'`) that imports the `registry` (canvas) or `@buildr/editor` (editor) — functions cannot cross the server-to-client boundary, which is why the registry import happens in a client module.
- Dynamic routes: `generateStaticParams` covers published slugs (per locale); `dynamicParams = true` allows ISR for new ones.

## generateMetadata, next/image, next/link

- `buildrMetadata(entry, defaults)` maps SEO fields (`meta.title/description/image/noIndex/canonical`) and `site-settings` onto `Metadata`. Fallbacks: the document's `title`, its excerpt, a featured image for OG. `noIndex` also applies in draft mode. `alternates.languages` (hreflang) is generated from every locale's localized slug.
- `createNextPlatform()` supplies `Link` (internal paths through `next/link`, external ones through a plain `<a>` with `rel`), `Image` (`next/image`, requiring `images.remotePatterns` for the media domain), and `formAction(layoutRef, nodeId)`.

## Preview / draft mode, caching, revalidation, errors

- **Draft mode**: `/buildr/preview` enables preview mode. `getBuildrDocument({ draft: true })` fetches the latest draft with the acting user's permissions (uncached). A banner reads "Viewing a draft — exit preview".
- **Caching**: published reads go through tagged functions (Next 16 Cache Components: `'use cache'` + `cacheTag`; `unstable_cache` as the fallback on 15.x). Tags: `buildr:doc:{c}:{id}`, `buildr:col:{c}` (via `collectionsUsed` for pages containing a Loop), `buildr:global:{slug}`, `buildr:template:{id}`, `buildr:theme`. Revalidation is triggered by Payload hooks (see [payload.md](payload.md#preview-url-and-revalidation)).
- **Error boundaries**: `BuildrSectionBoundary` (client) wraps each top-level child of the root on production, so one broken section cannot take down the whole page (logged via `onError`), plus standard `error.tsx`/`not-found.tsx` routes. A document that fails envelope validation is logged and falls through to `error.tsx`.
- **Headers**: `/buildr/canvas` -> `Content-Security-Policy: frame-ancestors 'self'`, `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`. `/buildr/edit/*` -> `frame-ancestors 'none'`, `noindex`. Public site pages -> `frame-ancestors 'self'` (so the editor's own preview can embed them).

## Implemented API: `BuildrPage` and the Next platform (PB-103)

`@buildr/next` exports:

- `createBuildrConfig({ registry, theme, platform, dataSource, messages?, onError?, cache? })` — a frozen bundle. `dataSource(context)` is called per render, so it can be a per-request Payload source; `messages(locale)` supplies the built-in strings.
- `BuildrPage({ config, entry, fallback?, sectionBoundaries? })` — an async Server Component. `entry` is `{ document, context, layoutRef?, currentId? }` (the shape `getBuildrDocument` produces in PB-107). It calls `renderDocument` from `@buildr/react/server`. Error-level diagnostics go to `onError`; a document that cannot be rendered throws (for `error.tsx`) unless `fallback` is given. In production every top-level section is wrapped in a `BuildrSectionBoundary` (`sectionBoundaries` overrides this).
- `createNextPlatform({ formAction? })` — internal paths (`/x`, `#x`, `?x`) use `next/link`; everything else is a plain `<a>` (with `noopener noreferrer` added for `target="_blank"`). `Image` uses `next/image` when width and height are known, else a plain `img`. `formAction` defaults to `/api/buildr/forms/:collection/:id/:nodeId` from the `{collection}:{id}` layout reference.
- `BuildrSectionBoundary` (`'use client'`) — the only client module of the page path; it logs the failure and renders `fallback` (nothing by default).
- `buildrMetadata(entry, defaults)` — maps SEO fields (`meta.title/description/image/noIndex/canonical`, with the title, excerpt and featured image as fallbacks) and `alternates` (hreflang) onto a `Metadata`-shaped object. `noIndex` and `draft` both give `robots: noindex`.

`next` is a peer dependency; it is a devDependency only so the platform can be tested.

## Implemented API: draft mode and preview (PB-104)

`@buildr/next/draft` exports:

- `createPreviewRoute({ authorize, defaultPath? })` — the `GET` of `/buildr/preview`. `authorize(request)` decides (a session check, a shared secret in the query); without a yes the answer is `401` and draft mode stays off. Then it calls `draftMode().enable()` and answers `307` to `?path=`.
- `createExitPreviewRoute({ defaultPath? })` — the `GET` of `/buildr/preview/exit`: `draftMode().disable()` and the same redirect. It needs no authorization.
- `safeRedirectPath(value, fallback = '/')` — the only source of redirect targets. A value is accepted only when it starts with a single `/` and contains no backslash or control character; `//host`, `/\host`, `https://…` and `javascript:` fall back to `defaultPath`. There is no open-redirect vector.
- `PreviewBanner({ message, exitLabel, exitHref?, returnTo? })` — a Server Component that renders only in draft mode. The texts are props, so the application supplies them in the site's language.

## Implemented API: the canvas route (PB-105)

`@buildr/next/canvas` exports:

- `BuildrCanvasPage({ authorize, children })` — the server wrapper of `app/(frontend)/buildr/canvas/page.tsx`. It reads request headers (which makes the route dynamic), calls `authorize()` and answers the site's own `notFound()` when it is not a yes, so the route does not reveal itself. `children` is the application's client file, rendered inside the site layout.
- `canvasMetadata` — export it as `metadata` from the page: `robots: noindex, nofollow`.
- `buildrSecurityHeaders({ canvasPath?, editPath? })` — the rules for `next.config` `headers()`: the canvas gets `frame-ancestors 'self'`, `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`; `/buildr/edit/*` gets `frame-ancestors 'none'` and `noindex`; every other page gets `frame-ancestors 'self'`.

The client file is the application's (functions cannot cross the server-to-client boundary):

```tsx
// app/(frontend)/buildr/canvas/canvas-client.tsx
'use client';
import { CanvasRuntime } from '@buildr/react';
import { createNextPlatform } from '@buildr/next';
import { registry, theme } from '@/buildr.registry';

export function CanvasClient(props: { manifestHash: string; rendererVersion: string }) {
  return <CanvasRuntime registry={registry} theme={theme} platform={createNextPlatform()} {...props} />;
}

// page.tsx
export const metadata = canvasMetadata;
export default function Page() {
  return <BuildrCanvasPage authorize={isEditorSession}><CanvasClient manifestHash={hash} rendererVersion={version} /></BuildrCanvasPage>;
}
```

## Implemented API: the editor route (PB-106)

`@buildr/next/editor` exports:

- `BuildrEditorPage({ collection, id, authorize, loginUrl, returnTo, manifest, canvasUrl?, config?, render })` — the server wrapper of `app/(builder)/buildr/edit/[collection]/[id]/page.tsx`. It makes the route dynamic, then calls `authorize()`: `true` renders, `false` (not signed in) redirects to `loginUrl?redirect=<returnTo>`, `'forbidden'` (signed in without the right) is the site's `notFound()`. Both `loginUrl` and `returnTo` pass through `safeRedirectPath`, so the redirect stays on the site.
- `render(props)` receives `{ manifest, canvasUrl, documentRef, config? }` — plain, serializable data — and returns the application's client file (`'use client'`), which builds the `DocumentAdapter` (`@buildr/payload/adapter`) and mounts `BuilderEditor`. Only that file imports `@buildr/editor`, so the editor's bundle loads on this route only.
- `editorMetadata` — `robots: noindex, nofollow`.

The manifest is computed on the server (`toManifest(registry.meta)`), so the palette never depends on a client-side import of component code. The `(builder)` route group has its own root layout with no site chrome.

## Implemented API: `getBuildrDocument`, tags and revalidation (PB-107)

`@buildr/payload/next` (server code of a Next.js app; it imports `next/cache`):

```ts
const entry = await getBuildrDocument({
  payload, collection: 'pages', slug, locale, draft, user,
  contextName: 'page', path: (doc) => `/${doc.slug}`,
});
if (!entry) notFound();
return <BuildrPage config={buildr} entry={entry} />;
```

- `getBuildrDocument({ payload, collection, slug | id, slugField?, locale?, draft?, user?, contextName?, path?, depth?, timeZone?, cache? })` finds the document, resolves its layout (`resolveLayout`), builds the `DataContext` (`buildContext`, with the `site` global when `site-settings` exists) and returns `{ document, context, layoutRef, layoutSource, currentId, doc, tags }`, or `null` for a `404` (no such document, an unpublished one for a visitor, an unconfigured locale). The first five fields are what `BuildrPage` takes. Exactly one of `slug` and `id` is required.
- **Published reads are cached** (`unstable_cache`, keyed by collection, slug or id, locale and depth) and tagged; a **draft read** (`draft: true` with a `user`) uses that user's permissions and is never cached. `draft: true` without a user is a visitor's read.
- `listPublishedSlugs({ payload, collection, slugField?, locale?, limit? })` gives the slugs for `generateStaticParams`.
- `seoFromDocument(doc, { locale, draft, alternates })` maps `@payloadcms/plugin-seo` fields onto `buildrMetadata`; `alternatesOf({ payload, collection, id, path })` gives the hreflang paths.

### Cache tag convention

| Tag | Set for | Revalidated when |
|---|---|---|
| `buildr:doc:{collection}:{id}` | a document, and a page whose layout is that document's own | it is published, was published (unpublish), or is deleted |
| `buildr:col:{collection}` | every read of the collection (a slug may resolve to another document) and pages whose queries read it (`collectionsUsed`) | any published change or delete in it, or a change of a template that targets it |
| `buildr:global:{slug}` | pages that read a global (`site-settings`) | the global changes |
| `buildr:template:{id}` | a page whose layout came from that template | the template changes |
| `buildr:theme` | every page | the theme changes (call `revalidateTag('buildr:theme')` where the theme is deployed) |

`tagsFor({ collection, id, layoutRef, collectionsUsed, globals })` computes the full set; the helpers `docTag`, `collectionTag`, `globalTag` and `templateTag` build single tags.

`revalidateHooks(revalidate?)` returns the Payload hooks: `collection` (`afterChange`, `afterDelete`) for page collections, `global.afterChange` for globals and `templates` (`afterChange`, `afterDelete`) for `buildr-templates`. Wire them in the application's collection configs. A draft save of a page that was never published revalidates nothing. Outside a Next.js request (a seed script) revalidation is a no-op.

## Implemented API: routing and rendering per locale (PB-117)

- **The language reaches the renderer through the entry**: `getBuildrDocument({ locale })` reads the document in that language (a locale that is not configured is a `404`, the cache key includes the locale) and puts it in `context.locale`; `BuildrPage` takes the built-in strings from `config.messages(context.locale)`. The site layout sets `<html lang={locale}>` from the same `[locale]` segment.
- `isLocale(value, { locales })` guards the `[locale]` segment (`notFound()` when false).
- `generateLocaleStaticParams({ locales, slugs, homeSlug? })` returns `{ locale, slug? }` per published slug of each language (`'a/b'` becomes `['a', 'b']`, the home slug becomes the bare `/{locale}`); feed `slugs` with `listPublishedSlugs({ locale })`.
- `buildrMetadata(entry, { defaultLocale })` turns `entry.alternates` (from `alternatesOf`) into `alternates.languages`, adding `x-default` for the default language.
- `negotiateLocale(acceptLanguage, { locales, default })` picks the best-weighted exact or primary-subtag match. `createLocaleMiddleware({ locales, default })` redirects **only the bare `/`** to `/{locale}` (with `Vary: Accept-Language`), so a cached page path never depends on a header or cookie:

  ```ts
  const locale = createLocaleMiddleware({ locales: ['pl', 'en'], default: 'pl' });
  export default (request: NextRequest) => locale(request) ?? NextResponse.next();
  export const config = { matcher: '/' };
  ```
- The preview route takes `locales`: `/buildr/preview?path=/about&locale=en` redirects to `/en/about`; a path that already starts with a language is left alone.

## The example application (PB-108)

`apps/example-next-payload` is a complete Next.js + Payload host for Buildr: `pnpm dev:example` starts it (SQLite file by default, Postgres when `DATABASE_URL` is set; see `.env.example`), and the admin is served at `/admin`.

- `src/payload.config.ts` — collections `users`, `media`, `authors`, `categories`, `product-categories`, `pages`, `posts`, `products`, the `site-settings` global, `pl` (default) and `en` localization, drafts on the three page collections, `plugin-seo`, and `buildrPlugin`.
- `src/buildr.options.ts` — the plugin's collections, `queryable` allowlist and access rules, shared with the frontend so they cannot drift.
- `src/buildr.registry.ts` — the component registry, theme and locales, importable from the Payload CLI.
- `src/app/(payload)` — the admin and REST routes; `admin/importMap.js` is generated (`pnpm generate:importmap`) and must be regenerated when an admin component is added.
- `src/app/(frontend)` — the public site (see below); `(builder)` and `(canvas)` — the editor and canvas routes.

## The example application's public routes (PB-109)

`apps/example-next-payload/src/app/(frontend)/[locale]` implements the route tree above:

- `layout.tsx` validates the `[locale]` segment (`notFound()` for an unknown language) and renders `<html lang>`; `error.tsx` and `not-found.tsx` sit beside it.
- `[[...slug]]` — pages (`home` is the bare `/{locale}`), `blog/[slug]` — posts, `products/[slug]` — products, `blog/page/[page]` — the "blog" page rendered with `route.params.page` for the listing's pagination.
- `src/lib/site.ts` — `load` (one cached read per request through `getBuildrDocument`, a draft read only when draft mode is on and a user is signed in), `metadataFor` (`seoFromDocument` + `alternatesOf` + `buildrMetadata`, so every language gets hreflang and `x-default`), `publishedSlugs` for `generateStaticParams` (a build without a reachable database prerenders nothing; `dynamicParams` renders on first visit).
- `src/proxy.ts` — Next 16 renamed `middleware.ts` to `proxy.ts`; it is `createLocaleMiddleware` for the bare `/`.
- `src/buildr.server.ts` — `createBuildrConfig` with `createNextPlatform()`, a per-render Payload data source, and the built-in messages.

## The example application's builder routes (PB-110)

The flow *Payload → "Edit with Visual Builder" → a separate tab → edit → save → preview → publish* runs through three route groups of `apps/example-next-payload/src/app`:

- `(builder)/buildr/edit/[collection]/[id]` — `BuildrEditorPage` (server: sign-in redirect to `/admin/login`, manifest) plus `editor-client.tsx` (`'use client'`: `createPayloadAdapter({ baseUrl: '/api' })` and `EditorApp`). It has its own root layout, so no site chrome and no site stylesheet.
- `(canvas)/buildr/canvas` — `BuildrCanvasPage` plus `canvas-client.tsx` (`CanvasRuntime` with the registry, plain-anchor platform, the builder API as data source, and `loadScopes` from `/api/buildr/data/context`). It renders nothing on the server: the canvas talks to its parent frame and needs `window.location.origin`.
- `(canvas)/buildr/preview` and `.../exit-preview` — `createPreviewRoute` (locale-aware, signed-in users only) and `createExitPreviewRoute`.
- `next.config.ts` carries the security header rules. They are the output of `buildrSecurityHeaders()`, written out because Node loads `next.config.ts` itself and does not compile a workspace package's TypeScript; an application using the published package imports the function instead.

Verified by hand against a local database: the editor opens, the canvas handshake completes, inserting a heading and publishing changes `/pl`. Automated end-to-end coverage is PB-112.

## The example application seeds (PB-111)

`pnpm --filter @buildr/example-next-payload seed` fills the database with the six demo scenarios in Polish (default) and English: a landing page (`home`), a company page (`about`, with pricing and FAQ), the blog listing (`blog`, eight posts so pagination has a second page), a contact page, and the default layout templates for `posts` and `products` (`buildr-templates`), plus authors, categories, media (generated SVG), posts and four products.

- **Idempotent.** Every document is looked up by its natural key (slug, filename) and skipped when present; a second run creates nothing.
- **Static, deterministic documents.** Page layouts are composed from `defaultTemplates` with a seeded id generator; the Polish text is the stored value and English rides along as `l10n.en`.
- **Checked in tests.** `src/seed/documents.test.ts` asserts that every seeded document passes `validateDocument` and `runA11y` with zero issues (`expectH1: "document"`).

## End-to-end tests of the example application (PB-112)

`apps/example-next-payload/e2e` is a Playwright suite (`pnpm --filter @buildr/example-next-payload e2e`; CI job `E2E`). `playwright.config.ts` starts `e2e/serve.mjs`, which recreates a SQLite file (`e2e.db`), runs the seed with an administrator (`e2e@buildr.test`; a test-only account created from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`), builds the app and serves the production build on port 3100.

- `public.spec.ts` — the six scenarios in `pl` and `en` (status, `<html lang>`, the heading), axe (WCAG 2 A/AA) on each, 404s, the redirect from `/`, hreflang + `x-default`, blog pagination, and that a static page loads no editor or canvas script.
- `editor.spec.ts` — each test edits its own scratch page (a copy of the landing page created through the REST API, so the seed stays untouched): the canvas handshake, insert, undo/redo, autosave and reload, a mobile-only style, a data binding, translating a heading and seeing it on `/en/...`, and publishing to the live page. The tests wait on visible states (the canvas heading, the "Published." status) and poll the server, never on timeouts.

Tests select by role and accessible name. `pnpm --filter @buildr/example-next-payload e2e --repeat-each=4` ran 164 tests with no failure.

### One copy of `@payloadcms/ui`

The admin field of `@buildr/payload` and the Payload admin must load the same copy of `@payloadcms/ui`, or its React contexts do not match (`Cannot destructure property 'config' ... as it is undefined` when the document view opens). pnpm makes one copy per combination of resolved peers, so in this monorepo `packages/payload` pins `next`, `payload` and `@types/node` to the same versions as the example application. An application using the published package has a single peer instance and needs nothing. `e2e/editor.spec.ts` opens the admin document view to catch a regression.
