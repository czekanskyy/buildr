# Payload integration

See also [ADR-010](adr/ADR-010-payload-integration.md).

## Integration model

| Option | Assessment | Role in the solution |
|---|---|---|
| A JSON field | Native (jsonb in Postgres, text in SQLite, an object in Mongo), versioned alongside the document | **Storage**: the `layout` field |
| A custom field (UI) | Hides the raw JSON | A **summary + "Edit with Visual Builder" button**, instead of a raw JSON editor |
| A custom admin view | Would pull the editor into Payload Admin, contradicting the product requirement | **Not used** as the editor surface |
| Custom endpoints | A stable contract, validation, concurrency, permissions | **The builder API**: `/api/buildr/*` |
| A plugin (config transform) | One-line install, consistent configuration | **Wraps everything** |

**Decision**: `buildrPlugin()` = a JSON field + a custom field UI + endpoints + hooks + supporting collections. The editor is a separate application that talks to these endpoints.

## Plugin configuration

```ts
buildrPlugin({
  registry,                                    // optional: prop validation, component migrations, manifest, form derivation
  routes: { editor: '/buildr/edit', canvas: '/buildr/canvas', preview: '/buildr/preview' },
  collections: {
    pages:    { context: 'page',    path: (d) => (d.slug === 'home' ? '/' : `/${d.slug}`), expectH1: true },
    posts:    { context: 'post',    path: (d) => `/blog/${d.slug}`,     templates: true, depth: 1 },
    products: { context: 'product', path: (d) => `/products/${d.slug}`, templates: true, depth: 1 },
  },
  globals: { site: 'site-settings' },
  queryable: {                                 // allowlist for Loop/QuerySpec
    posts:    { fields: ['title', 'slug', 'publishedAt', 'categories', 'author'], sort: ['publishedAt', 'title'] },
    products: { fields: ['title', 'price', 'categories', 'availability'],          sort: ['price', 'title'] },
  },
  media: { collection: 'media' },
  forms: { enabled: true, notifyAllowlist: ['@example.com'] },
  access: {
    edit:    ({ req }) => Boolean(req.user),
    publish: ({ req }) => ['admin', 'editor'].includes(req.user?.role),
    unlockTemplates: ({ req }) => req.user?.role === 'admin',
  },
  limits: { maxNodes: 5000, maxBytes: 2_000_000 },
  a11y: { publish: 'warn' },                   // 'warn' | 'block'
})
```

`registry` can be a full React registry, or just `registry.meta` plus migrations — the plugin only ever uses metadata and migrations. Component definitions do not import CSS (CSS is imported once, in the application layout), so the registry can also load inside a Payload CLI process.

**What the plugin adds**: to every configured collection — a `layout` field (`json`, with `admin.components.Field` pointing at `@buildr/payload/admin#LayoutField`), a hidden, read-only `buildrRevision` (`number`) field, and, when `templates: true`, a `template` relationship field to `buildr-templates`. The plugin requires `versions.drafts` (validated at startup). It also adds the `buildr-templates` collection (`title`, `targetCollection`, `isDefault`, `layout`, `buildrRevision`, drafts) and `buildr-form-submissions`; write-guard and revalidation hooks; the endpoints listed below; and the "Edit with Visual Builder" button (inactive for an unsaved document), which opens `/buildr/edit/{collection}/{id}` in a named window (`window.open(url, 'buildr-{collection}-{id}')`, reusing the same tab on repeat clicks).

## Endpoint contract

| Method | Path | Input | Output | Permission |
|---|---|---|---|---|
| GET | `/api/buildr/session` | — | `{ user, permissions, limits, locales }` | authenticated |
| GET | `/api/buildr/manifest` | — | `RegistryManifest` | edit |
| GET | `/api/buildr/documents/:collection/:id` | `?draft=1&locale=` | `{ ref, title, slug, status, updatedAt, revision, document, contextRef, previewPath, readOnly? }` | read + edit |
| PUT | `/api/buildr/documents/:collection/:id` | `{ document, baseRevision, autosave }` | `200 { revision, updatedAt }` / `409 { currentRevision }` / `422 { diagnostics }` | edit |
| POST | `/api/buildr/documents/:collection/:id/publish` | `{ baseRevision }` | `200 { status, publishedAt }` / `409` / `422` | publish |
| GET | `/api/buildr/data-schema/:collection` | — | `DataSchema` | edit |
| GET | `/api/buildr/data/context` | `?collection&id&draft&locale` | `{ scopes }` | edit |
| POST | `/api/buildr/data/query` | `{ spec, contextRef, locale }` | `QueryResult` | edit |
| POST | `/api/buildr/data/media` | `{ ids }` | `Record<id, MediaAsset>` | edit |
| GET/POST | `/api/buildr/media` | `?search&type&page` / multipart `{ file, alt }` | `{ items, page, totalPages }` / `MediaAsset` | read/create media |
| GET | `/api/buildr/samples/:collection` | `?search` | `{ items: { id, title }[] }` | edit (template sample data) |
| POST | `/api/buildr/forms/:collection/:id/:nodeId` | form data / JSON | `{ ok }` / `422` / `429` | public |

Read/data endpoints accept a `locale` parameter (defaulting to the default locale) and pass it through to the Local API's own `locale`/`fallbackLocale`. Every endpoint runs Local API calls with `user: req.user, overrideAccess: false`. Request/response types are defined once (Zod, `@buildr/payload/src/contract.ts`) and shared between the endpoint implementations and the HTTP adapter.

## Save, autosave, drafts, publish, versions

- **Save**: read the latest draft -> compare `buildrRevision` against `baseRevision` (a mismatch is `409`) -> validate (`validateDocument`, limits) -> migrate to the latest versions -> `payload.update({ collection, id, data: { layout, buildrRevision: rev + 1 }, draft: true, autosave, user, overrideAccess: false, context: { buildrWrite: true } })`.
- **Autosave vs. Save**: autosave passes `autosave: true`, so Payload updates the current autosave version in place instead of creating a new one (no version flood). Ctrl+S / "Save" creates a new draft version (a meaningful history). `versions.maxPerDoc: 50`.
- **Write-guard (critical)**: Payload Admin's own save action submits every field's value, including the stale `layout` it loaded when the form opened — without protection it would overwrite in-progress builder edits. A `beforeChange` hook on `layout`/`buildrRevision` only accepts the incoming value when `req.context.buildrWrite === true` (or on `create`); otherwise it preserves the current version's value. This is covered by a dedicated integration test: "editing the title in the admin while autosaving the layout in the builder must not lose data" (risk R2 in the backlog).
- **Publish**: read the latest draft -> revision check -> validation and the accessibility policy -> `payload.update({ data: { ...draft, _status: 'published' }, draft: false, ... })`. Publishing from the builder publishes the **entire** document, including fields edited in the admin — this is surfaced explicitly in the publish dialog's copy.
- **Version history**: in MVP, a "Version history" link points at Payload Admin's own Versions tab. A builder-native version list and restore flow ships in v0.2.
- **Document locking**: integration with Payload's document-locking feature ("X is editing in the admin") ships in v0.2.

## Authentication and authorization

- **MVP (same-origin)**: the `payload-token` HttpOnly cookie is sent automatically (`credentials: 'same-origin'`). Endpoints use `req.user`. The editor/canvas/preview Next.js routes verify the user via `payload.auth({ headers })` and redirect to `/admin/login?redirect=...`.
- **Authorization**: Payload's own collection access control (read/update) plus the plugin's `access.edit/publish/unlockTemplates` functions. The server always enforces this; the UI only hides actions the user cannot perform. Multi-tenant setups (Payload's multi-tenant plugin) work because every operation flows through the acting user's own access control.
- **Standalone cross-origin (v0.3)**: an admin button posts to `/api/buildr/handoff` (a one-time code, 60s TTL, bound to the user and the document) -> `https://builder.example.com/#code=...` (a URL fragment, so it never reaches server logs) -> exchanged for a short-lived token (15 minutes plus refresh) scoped to that document. This needs a CORS allowlist; the canvas stays on the site's own origin with `frame-ancestors` set to the builder's origin.

## Payload data model

**Pages**

| Field | Type | Notes |
|---|---|---|
| `title` | text, required | |
| `slug` | text, unique, indexed | derived from `title`; pattern `^[a-z0-9-]+(/[a-z0-9-]+)*$`; `home` maps to `/` |
| `layout` | json (buildr) | the builder document |
| `buildrRevision` | number (hidden) | concurrency control |
| `meta` | group (`@payloadcms/plugin-seo`): title, description, image, noIndex, canonical | |
| `publishedAt` | date | |
| `_status` | draft/published (drafts) | |
| `parent` | relationship -> pages | v0.2 (nested paths) |

**Posts**: `title`, `slug`, `excerpt` (textarea, <= 300 chars), `featuredImage` (upload -> media), `author` (relationship -> **authors**), `categories` (relationship -> categories, hasMany), `publishedAt`, `content` (Lexical rich text, the article body edited in Payload), `readingTime` (number, computed in a hook), `template` (-> buildr-templates, optional), `layout` (optional override), `buildrRevision`, `meta`, `_status`.

**Products**: `title`, `slug`, `sku`, `price` (number), `currency` (select, defaults from site settings), `compareAtPrice`, `images` (upload hasMany), `shortDescription` (textarea), `description` (richText), `categories` (-> product-categories), `availability` (select: inStock/outOfStock/preorder), `buyUrl` (url — a CTA link in MVP), `attributes` (array: name, value), `template`, `layout`, `buildrRevision`, `meta`, `_status`.

**Authors** (a public profile, deliberately **separate from `users`** so the auth collection is never exposed): `name`, `slug`, `avatar`, `bio`, `jobTitle`, `socials` (array).

**Categories / ProductCategories**: `title`, `slug`, `description`, `parent`.

**Media** (upload): `alt` (required), `caption`, focal point, sizes `thumbnail 400`, `card 800`, `hero 1600`, `og 1200x630`.

**Users** (auth): `name`, `role` (`admin | editor | author`).

**Global `site-settings`**: `siteName`, `logo`, `locale`, `timeZone`, `defaultCurrency`, `defaultSeo`, `social`.

**Plugin collections**: `buildr-templates`; `buildr-form-submissions` (`form: { collection, id, nodeId }`, `data` json, `locale`, `meta`: userAgent, IP hash, `createdAt`).

**Localization (example app: `pl` default, `en`)**: `localized: true` on `title`, `slug`, `excerpt`, `content`, `description`, `shortDescription`, `meta`, media `alt`/`caption`, `bio`, and global text fields. `layout` is **not** localized — see [i18n.md](i18n.md).

**Resolving a layout** (`resolveLayout`): `doc.layout` (if non-empty) -> `doc.template.layout` -> the collection's default template (`isDefault`) -> a built-in minimal template (title + body). The result carries a `layoutRef` (which document the layout actually came from), used by forms and cache tags. When editing a document that inherits a template, the editor offers "Edit the template" or "Create an own layout (copy the template)".

**Building context and the data schema**: `buildContext({ collection, doc, depth })` returns `{ site, [context]: normalize(doc), route }`. Normalization turns uploads into `MediaAsset`s, dates into ISO strings, and relations into plain objects. Field-type mapping: text/textarea -> string; number -> number; checkbox -> boolean; date -> date; select/radio -> enum; richText -> richText; upload -> media (hasMany -> list<media>); relationship -> ref (hasMany -> list<ref>); group -> object; array -> list<object>. `blocks`, `json`, `point`, `code` and `join` fields, plus any hidden or sensitive field, are excluded in MVP.

## Media

```ts
export interface MediaRef { source: 'payload'; collection: string; id: string;
  snapshot?: { url: string; alt?: string; width?: number; height?: number; mimeType?: string } }
export interface MediaAsset { id: string; url: string; alt?: string; width?: number; height?: number; mimeType: string;
  focalPoint?: { x: number; y: number }; sizes?: Record<string, { url: string; width: number; height: number }> }
```

- **Image -> static asset**: a picker (`/api/buildr/media`, search, upload requiring `alt`) stores a `MediaRef`. The renderer resolves IDs in a single batch during `prepareRender`, so library-side changes (URL, alt, crop) propagate automatically. `snapshot` provides thumbnails in the editor and a fallback.
- **Image -> dynamic field**: a binding, e.g. `post.featuredImage`. The context already carries a normalized `MediaAsset`.
- **Video -> URL / asset** (v0.2): `{ type: 'asset', ref } | { type: 'provider', provider: 'youtube' | 'vimeo', id }` (an allowlisted provider set, privacy-enhanced, click-to-load).
- **Gallery -> a collection of assets** (v0.2): `p.list(p.media())`, or a `list<media>` binding (`product.images`). In MVP the same result comes from looping over `product.images` with an Image bound to `item`.
- Rendering uses `platform.Image` (Next: `next/image` with `width`/`height` from the asset, `sizes` from a presets prop, `object-position` from the focal point, `priority` for the first hero image).

## Preview URL and revalidation

- `previewUrl(ref)` returns `/buildr/preview?collection=posts&id=123`. Its route handler (`@buildr/next/draft`) checks the user, enables `draftMode()`, and redirects to `path(doc)` (relative paths only, preventing open redirect).
- `@buildr/payload/next`'s `revalidateHooks()` wires `afterChange` (on publish, or a change to an already-published document) and `afterDelete` to call `revalidateTag` for `buildr:doc:{collection}:{id}`, `buildr:col:{collection}`; a global change triggers `buildr:global:{slug}`; a template change triggers `buildr:template:{id}` plus `buildr:col:{targetCollection}`.

## The plugin scaffold (PB-093)

`buildrPlugin(options)` (`@buildr/payload/plugin`) validates its options with Zod at startup (every problem is listed in one error) and then, for each collection in `options.collections`:

- checks that the collection exists, has `versions.drafts` enabled and does not already use the names `layout`, `buildrRevision` or `template`;
- adds `layout` (`json`, admin component `@buildr/payload/admin#LayoutField`, receiving `editorRoute` as a client prop), the hidden read-only `buildrRevision` (default `0`) and, when `templates: true`, the `template` relationship to `buildr-templates` (the collection itself arrives with the templates task);
- guards `layout` and `buildrRevision` with the **write-guard**: on `update`, the incoming value is used only when `req.context.buildrWrite === true` (`BUILDR_WRITE`); otherwise the stored value (`originalDoc`, which Payload sets to the latest draft when drafts are on) is kept. Creating a document accepts the value as sent.

`LayoutField` shows the number of elements in the stored layout and the "Edit with Visual Builder" button. The button is disabled until the document has an id, and opens `{editor route}/{collection}/{id}` with `window.open(url, 'buildr-{collection}-{id}')`, so repeat clicks reuse the same window. The presentational `LayoutFieldView` has no Payload UI import, which keeps it testable; `LayoutField` loads the Payload-UI-connected component lazily, so the entry point still imports in plain Node (the Payload CLI, the smoke test).

Tests run Payload's Local API on SQLite. Payload pushes the schema through drizzle-kit state shared by the whole process, so a test file can hold only one live Payload instance; structural checks use `buildConfig` without connecting.
