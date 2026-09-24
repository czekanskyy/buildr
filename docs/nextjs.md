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
