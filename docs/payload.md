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

**Plugin collections**: `buildr-templates`; `buildr-form-submissions` (`form: { collection, documentId, nodeId }`, `data` json, `locale`, `meta`: userAgent, IP hash, `createdAt`; added when `forms.enabled`).

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
- adds `layout` (`json`, admin component `@buildr/payload/admin#LayoutField`, receiving `editorRoute` as a client prop), the hidden read-only `buildrRevision` (default `0`) and, when `templates: true`, the `template` relationship to `buildr-templates` (the collection is added by the plugin, see "Templates and resolveLayout");
- guards `layout` and `buildrRevision` with the **write-guard**: on `update`, the incoming value is used only when `req.context.buildrWrite === true` (`BUILDR_WRITE`); otherwise the stored value (`originalDoc`, which Payload sets to the latest draft when drafts are on) is kept. Creating a document accepts the value as sent.

`LayoutField` shows the number of elements in the stored layout and the "Edit with Visual Builder" button. The button is disabled until the document has an id, and opens `{editor route}/{collection}/{id}` with `window.open(url, 'buildr-{collection}-{id}')`, so repeat clicks reuse the same window. The presentational `LayoutFieldView` has no Payload UI import, which keeps it testable; `LayoutField` loads the Payload-UI-connected component lazily, so the entry point still imports in plain Node (the Payload CLI, the smoke test).

Tests run Payload's Local API on SQLite. Payload pushes the schema through drizzle-kit state shared by the whole process, so a test file can hold only one live Payload instance; structural checks use `buildConfig` without connecting.

## Validation and migration on every write (PB-094)

The `layout` field runs one `beforeChange` chain, so the data is protected whatever the write path (Local API, Payload REST, the builder endpoints, a script): the write-guard first, then — for the writes that may change the layout (a create, or `context.buildrWrite`) — `processLayout`:

1. a missing layout becomes `createEmptyDocument()` (a new document starts with a valid one);
2. the value is migrated to the current document schema (`migrateDocument`), then parsed against the limits (`parseDocument`; `limits.maxNodes` / `limits.maxBytes` can only tighten the model defaults);
3. when the registry carries `migrations`, components are migrated to their current versions (`migrateComponents`); a component written by newer code rejects the write;
4. when a registry is configured, `validateDocument` runs; issues with severity `error` reject the write, warnings are logged through `payload.logger.warn`.

A rejected write throws Payload's `ValidationError` with one error on the path `layout`; its message lists every problem (`message (path)`), so the admin shows it under the field and REST returns it in `errors[0].data.errors`. The builder endpoints reuse `processLayout` (exported from `@buildr/payload/plugin`) and map its diagnostics to `422`. A layout that the write-guard keeps (an admin save) is not validated again.

The `registry` option takes `{ meta, migrations? }`: a React registry fits, and so does `{ meta: registry.meta }` alone (then only structure and props are validated).

## The document endpoints (PB-095)

The plugin registers the [endpoint contract](#endpoint-contract) as Payload endpoints under `/api`. The Zod schemas of every request and response live in `packages/payload/src/contract.ts` (the editor's HTTP adapter parses with the same ones).

| Endpoint | Purpose | Failures |
|---|---|---|
| `GET /buildr/session` | user, `canEdit` / `canPublish`, limits | `401` |
| `GET /buildr/manifest` | the registry manifest | `401`, `404` without a registry |
| `GET /buildr/documents/:collection/:id` | latest draft: layout (migrated in memory), title, slug, status, revision, `previewPath`, `readOnly` | `401`, `404` |
| `PUT /buildr/documents/:collection/:id` | save `{ document, baseRevision, autosave }` | `400`, `401`, `403`, `404`, `409 { currentRevision }`, `422 { diagnostics }` |
| `POST /buildr/documents/:collection/:id/publish` | publish the latest draft, `{ baseRevision }` | as above; `422` also for a11y errors when `a11y.publish: 'block'` |

- Every call is made with the caller's `req` and `overrideAccess: false`, so Payload's own access control applies; `options.access` may narrow `edit` / `publish` further.
- A save sets `buildrRevision = current + 1`. A stale `baseRevision` is a `409`, so an admin edit and a builder edit never overwrite each other silently. An admin save that leaves `layout` untouched keeps the builder's layout (the write-guard).
- `autosave: true` updates the current autosave version in place; an explicit save creates a version.
- Publishing writes `_status: 'published'` for the whole latest draft, admin-edited fields included.
- A document written by a newer component version is returned with `readOnly: true` and is never rewritten.

## Access control and CSRF (PB-096)

- **Authentication**: every builder endpoint answers `401` without a Payload user.
- **Permissions** (`plugin/access.ts`): `access.edit`, `access.publish` and `access.unlockTemplates` decide per request; without a function any authenticated user may. Reading a document opens the builder, so it needs `edit` (`403` otherwise); saving needs `edit`; publishing needs `publish`. The session response reports `permissions: { canEdit, canPublish, canUnlockTemplates }` so the UI can hide what the server would refuse.
- **Collection access**: every Local API call uses the caller's `req` and `overrideAccess: false`, so Payload's own read/update rules (and multi-tenant scoping) apply on top of the plugin's functions.
- **CSRF** (`endpoints/guards.ts`): `PUT` and `POST` need `Content-Type: application/json` (`415`), and an `Origin` header, when present, must be the server's own origin or in Payload's `csrf` allowlist (`403`). Requests without an `Origin` (scripts) pass; browsers always send it.

## DataSchema and context from Payload (PB-097)

`@buildr/payload/data` derives the [`DataSchema`](dynamic-bindings.md) and the data context from the Payload config, so bindings are typed without a hand-written schema.

- **`schemaFromCollection(source, collection, { contextNames, siteGlobal })`** returns `{ scopes, entities }`: the scopes `site` (the `site-settings` global, when it exists), the collection under its context name (`page`, `post`, ...) and `route` (`path`, `locale`, `params.page`); every relation target becomes an entity (named after its context name, else its slug), transitively, so cycles such as authors <-> posts are fine.
- **Field mapping** as in [Building context and the data schema](#payload-data-model) above; `hasMany` wraps the type in `list`; `row`/`collapsible`/unnamed tabs are flattened and a named tab is an `object`. Documents also carry `id`, `createdAt`, `updatedAt`.
- **Never exposed**: auth collections (so `users` never appears, and a relation to one is dropped), `payload-*` and `buildr-*` collections, polymorphic relations, hidden fields, fields with a field-level `access.read`, fields whose name looks like a credential (`password`, `secret`, `token`, `salt`, `hash`, `apiKey`, ...), the builder-owned `layout`, `buildrRevision` and `_status`, and the unsupported kinds `blocks`, `json`, `point`, `code`, `join`.
- **`buildContext({ source, options, collection, doc, site, route })`** returns `{ site, [context]: doc, route }` with the same allow-list: dates become ISO strings, uploads `MediaAsset`s (an upload that was not populated is `null`), relations plain objects (`{ id }` when not populated). Nothing outside the schema is ever copied, whatever the document holds.
- **Endpoints** (all need `edit`): `GET /buildr/data-schema/:collection`; `GET /buildr/data/context?collection&id&draft&locale` (populates at least one relation level and reads the site global with the user's own access); `GET /buildr/samples/:collection?search` (up to 20 `{ id, title }` for previewing a template).

## PayloadDataSource and data endpoints (PB-098)

`createPayloadDataSource({ payload, req?, queryable, mediaCollection?, contextNames?, depth?, scanLimit? })` (`@buildr/payload/data`) is the server `DataSource` of ADR-018. It passes the same contract suite as `MemoryDataSource` (`@buildr/test-utils/contracts/data-source`).

- **Allowlist**: only collections in `options.queryable` can be queried, and only by the listed `fields` and `sort` keys (paths such as `author.name` walk groups and single relations). Auth collections, hidden and credential-like fields never resolve, even when listed. Anything else is a `DataQueryError` (`422` over HTTP). `limit` is 1..50, `page` is 1 or more.
- **Access**: every call runs with `overrideAccess: false` and the given `req`, so the reader's collection access applies. Production reads published documents only; `preview` and `canvas` read drafts.
- **Translation**: conditions Payload evaluates like the contract (typed scalars, missing values; a nullable field's `neq`/`nin` also match a missing value) go to the database, so paging and `total` are the database's. What it cannot decide (case-sensitive `contains`, lists, ranges over booleans/ids, an optional sort key, since missing values must sort last in both directions) is finished in memory by `MemoryDataSource` over the documents the database already narrowed. More than `scanLimit` (default 1000) candidates is a `DataQueryError`: narrow the filter.
- **Limitation**: Payload stores no difference between a missing `hasMany` field and `[]`, so `exists` is only meaningful on scalar fields.
- **Endpoints** (need `edit`, JSON body, CSRF guard): `POST /buildr/data/query { spec, locale? }` returns a `QueryResult` (`mode: 'canvas'`); `POST /buildr/data/media { ids, locale? }` returns `{ [id]: MediaAsset }` from `options.media.collection`; unknown ids are left out.

## Media endpoints (PB-099)

Both need `edit`, the `media.collection` option and the caller's own access on that collection (`overrideAccess: false`); without the option they answer `404`.

- `GET /buildr/media?search&type&page`: `{ items: MediaAsset[], page, totalPages }`, newest first, 24 per page. `search` matches `alt` and `filename`; `type` is `image`, `video` or `audio` (by `mimeType` prefix). A bad `type` or `page` is `400`.
- `POST /buildr/media` (multipart `file` + `alt`): creates the upload through the Local API and answers the `MediaAsset` (`201`). A missing or empty file is `400`, a blank `alt` `422`, a file over 10 MB `413`. The CSRF guard for multipart requires a valid `Origin` when one is sent (`403`), since a cross-site form can send multipart without a preflight.
- **Hosting limit**: the file is buffered in memory, and serverless hosts cap request bodies (often 4.5 MB); the builder does not raise that cap, so large uploads may be refused by the host before they reach the endpoint.

## The HTTP adapter (PB-100)

`@buildr/payload/adapter` is the browser-side client of the builder API; it never imports `payload`, `@payloadcms/*` or `next` (dependency-cruiser and a test enforce it) and needs only `fetch`, `FormData` and `File`, so it works in the browser without polyfills.

- **`createPayloadAdapter({ baseUrl, fetch?, credentials?, locale?, timeZone?, previewRoute?, adminRoute? })`** returns the editor's `DocumentAdapter`. `baseUrl` is Payload's API root (`/api`). Cookies travel with same-origin requests; use `credentials: 'include'` for a cross-origin CMS.
- **`createPayloadCanvasDataSource({ baseUrl, ... })`** returns a `DataSource` for the canvas: `query` -> `POST /buildr/data/query`, `getMedia` -> `POST /buildr/data/media` (one batch, de-duplicated).
- **Validation**: every response is checked against the schemas of `contract.ts`; a document is parsed with core's `parseDocument`. A body that breaks the contract rejects.
- **Results and rejections**: a save or publish answered `409` is `{ ok: false, kind: 'conflict', currentRevision }`, `422` is `{ ok: false, kind: 'invalid', diagnostics }`. Everything else that is not `200` (no network, `401`, `403`, `404`, `5xx`) rejects with an `AdapterError { status?, message }`, which the editor retries or shows.
- **Session and locales**: the session is fetched once and cached (until it fails); `GET /buildr/session` now also sends `locales` when Payload localization is configured. `getContext` uses `options.locale()` (else the default language) and `options.timeZone` (else the browser's) to complete the `DataContext`.
- **Media**: `media.search` maps `mimeTypes` (when all share one type) to `type`, the cursor is the page number; `media.upload(file, alt)` posts multipart and rejects with the server's reason on `422` (no `alt`).
- `@buildr/editor` is an optional peer used for types only.

## Templates and `resolveLayout` (PB-101)

When at least one collection is configured with `templates: true`, the plugin adds the `buildr-templates` collection (drafts with autosave, up to 50 versions per template). Defining a collection with that slug yourself is an error.

| Field | Meaning |
|---|---|
| `title` | Required. |
| `targetCollection` | Required. One of the collections that take templates. |
| `isDefault` | The collection's default template. At most one per `targetCollection`: saving a second default is rejected with a validation error on `isDefault` (unmark the other one first). |
| `layout` | JSON. Validated and normalised like a document's layout (an invalid layout never reaches the database). |

Access: anyone signed in reads templates, visitors read the published ones (a rendered page needs its template); create, update and delete need the builder's `edit` permission.

### Resolution order

`resolveLayout({ payload, req?, collection, doc, contextName, draft?, overrideAccess? })` (exported from `@buildr/payload/data`) returns `{ layout, source, layoutRef }`, taking the first that has content (a root with at least one child):

1. `document`: the document's own `layout`.
2. `template`: the template the document points at (`doc.template`). A template of another collection is never used.
3. `default-template`: the collection's `isDefault` template.
4. `builtin`: a minimal layout, a level-1 heading bound to `{contextName}.title` and a rich text bound to `{contextName}.content`. It belongs to no document, so `layoutRef` is `null`.

Unless `draft` is set, only published templates count; access applies as for `req` (no `req` reads as a visitor, `overrideAccess: true` is for trusted server-side rendering). `layoutRef` is `{collection}:{id}`, the form the renderer and cache tags use.

### In the editor

`GET /buildr/documents/:collection/:id` adds `layoutSource` and `layoutRef` to the response. A document that inherits is opened with the template's layout as `document`, so saving writes it as an own layout ("create an own layout"). For `builtin` the canvas stays blank: the built-in layout is only a render fallback.

Editing a template in the builder is not part of this task: for now the layout of a template is a validated JSON field.

## Forms (PB-102)

With `forms: { enabled: true }` (this needs `registry`: the plugin refuses to start without it) the plugin adds the `buildr-form-submissions` collection and the public endpoint `POST /api/buildr/forms/:collection/:id/:nodeId`. The form is the `buildr/form` component; `:collection`/`:id` is the `layoutRef` of the rendered layout, so it is a configured collection or `buildr-templates` (a form of an inherited layout lives in its template).

```ts
forms: {
  enabled: true,
  notifyAllowlist: ['@example.com', 'ops@partner.example'], // exact addresses or @domains
  notifyTo: ['ops@example.com'],                            // every one must match the allowlist (checked at startup)
  rateLimit: { limit: 5, windowMs: 60_000 },                 // per visitor and form; the in-memory limiter
  rateLimiter,                                               // optional: your own RateLimiter { hit(key) }
}
```

**The client never decides what the form accepts.** The endpoint loads the *published* document (`_status: 'published'`; a draft or a never-published document answers `404`), resolves its layout (own layout, else its template, see above), checks that `:nodeId` is a `buildr/form` node and derives the schema with `deriveFormSchema` from that layout only. A newer, unpublished draft therefore changes nothing. `validateSubmission` then checks the values: a name outside the schema is refused (`unknown`), and every value against its type (`string`, `email`, `tel`, `url`, `number`, `boolean`, `enum`), `required`, `maxLength` (5000 when the field sets none) and its options.

Order of the checks: route and collection (`404`) → rate limit (`429`, `Retry-After`) → body (`415` for anything but JSON, urlencoded or multipart; `413` above 64 KB) → honeypot → published document and form (`404`) → validation (`422`) → store → notify.

- **Answers.** A JSON request (`Content-Type: application/json` or `Accept: application/json`, which the form's enhancement sends) gets `{ ok: true }`, or `422 { errors: { field: message }, codes: { field: code } }` (`codes` for clients that localize). A plain HTML form gets `303` back to the `Referer` page (only when it is on the same origin, otherwise `/`) with `?buildr-form=sent` or `?buildr-form=invalid`.
- **Honeypot.** The form renders an `_hp` input nobody sees. A submission with it filled is answered as a success and stored nowhere, so a bot learns nothing.
- **Rate limiting.** Keyed by a hash of the visitor's address (`X-Forwarded-For`, then `X-Real-IP`; put the site behind a proxy that sets it) and the form. `createMemoryRateLimiter` keeps its windows in one process's memory (bounded), so it does not work across serverless instances: pass a `rateLimiter` backed by a shared store (Redis) there.
- **Stored.** `form: { collection, documentId, nodeId }`, `data` (the validated values, typed), `locale`, `meta: { userAgent, ipHash }`. The IP is stored only as `sha256(secret:ip)`, cut to 32 hex characters. Only signed-in users read or delete submissions; nobody creates them but the endpoint.
- **Email.** Each submission is mailed through Payload's `sendEmail` to `notifyTo`, filtered through `notifyAllowlist` once more when sending. A failing mail server is logged and never fails the submission.
- **CSRF.** The endpoint is public by design (a plain HTML form must work) and only creates a submission; the honeypot and the rate limiter are what protect it.

## Localization (PB-116)

`localeConfigOf(config)` (`plugin/locales.ts`) derives core's `LocaleConfig` from Payload's `localization`: `locales` (the codes), `default`, `fallback` (`localization.fallback !== false`) and `intl` (the labels, in the default language, for the editor's language switcher). Without localization it is a single locale (`en`, no fallback); `configuredLocales` is `undefined` then, and everything below behaves as it did before.

- **Session.** `GET /buildr/session` carries `locales` only when localization is configured.
- **The `locale` parameter.** `GET documents/:collection/:id`, `GET data/context`, `POST data/query` and `POST data/media` (body), `GET samples/:collection`, `GET media` and `POST forms/...` take `locale`. It is mapped to Local API's `locale`, and `fallbackLocale: false` when the configuration turns `fallback` off (otherwise Payload's own fallback to the default language applies). No value means the default language; a code that is not configured (or `all`) is `400`. Without localization the parameter is ignored.
- **Context.** `route.locale` of the data context is the language asked for (the default one when none), so bindings and `formatDate`/`plural` see it.
- **Forms.** A submission records the `locale` it came from (the `locale` query parameter of the form action).
- **Layout.** `layout` is not `localized`: translations live in the document's `l10n` maps. Saving, publishing and the write hooks validate those keys against the site's locales: a key outside them is a warning (kept in the document). Without localization no key is checked.
