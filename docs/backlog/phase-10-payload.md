# Phase 10: The Payload plugin and integration

## PB-093 - Plugin scaffold, fields, write-guard, admin UI - L

- **Purpose**: a one-line install (see `docs/payload.md`).
- **Dependencies**: PB-007
- **Files**: `packages/payload/src/plugin/{index,options,fields,write-guard}.ts`, `src/admin/layout-field.tsx`
- **Implementation**: Zod-validated options; the `layout`, `buildrRevision`, `template` fields; requiring `versions.drafts`; the write-guard hook (see `docs/payload.md`); `LayoutField` (a summary plus a button, inactive for unsaved documents); Payload import-map wiring.
- **Tests**: Payload Local API tests on SQLite: plugin installation, field presence, **write-guard: an update without `context.buildrWrite` never changes `layout` (including for drafts)**.
- **Acceptance criteria**: the button opens `/buildr/edit/{collection}/{id}` in a named window.
- **Risks**: draft `originalDoc` semantics (risk R2) — if insufficient, the hook explicitly reads the latest draft version instead of relying on it.

## PB-094 - Validation and migration hooks - M

- **Purpose**: protecting data regardless of the write path.
- **Dependencies**: PB-093, PB-041
- **Files**: `packages/payload/src/plugin/hooks/*.ts`
- **Implementation**: parse plus limits plus migrations (when a registry is configured) plus `validateDocument` (errors become 422, warnings are logged); `createEmptyDocument` on create.
- **Tests**: writing an invalid document via both Local API and REST is rejected; migration runs on save.
- **Acceptance criteria**: error messages are readable inside the admin UI.
- **Risks**: none.

## PB-095 - Document endpoints - L

- **Purpose**: the builder API (see `docs/payload.md`).
- **Dependencies**: PB-094
- **Files**: `packages/payload/src/plugin/endpoints/{session,document,save,publish,manifest}.ts`, `src/contract.ts`
- **Implementation**: the Zod contract; save with revision checking (409), autosave-vs-save semantics, 422 with diagnostics; publish (the latest draft to published, applying the accessibility policy); manifest.
- **Tests**: integration: the happy path, 401, 409, 422, publish changing `_status`, **concurrent admin plus builder edits never lose data**.
- **Acceptance criteria**: the contract is documented in `docs/payload.md`.
- **Risks**: a race between the revision check and the write (a millisecond-scale window) — acceptable in MVP given single-flight saves; a database transaction is planned for v1.0.

## PB-096 - Access control and CSRF - M

- **Purpose**: authorization (see `docs/payload.md`, `docs/security.md`).
- **Dependencies**: PB-095
- **Files**: `packages/payload/src/plugin/access.ts`, `endpoints/guards.ts`
- **Implementation**: `access.edit`/`access.publish`/`access.unlockTemplates`, collection-level permissions (`overrideAccess: false`), `Origin`/`Content-Type` checks, `permissions` in the session response.
- **Tests**: a role x endpoint matrix (401/403/200).
- **Acceptance criteria**: no endpoint (other than the public forms endpoint) works without an authenticated user.
- **Risks**: none.

## PB-097 - `DataSchema` and context from Payload - L

- **Purpose**: typed bindings (see `docs/payload.md`).
- **Dependencies**: PB-093, PB-019
- **Files**: `packages/payload/src/data/{schema-from-fields,build-context,normalize}.ts`, `plugin/endpoints/{data-schema,context,samples}.ts`
- **Implementation**: field-type mapping, exclusion of sensitive fields, relation entity types, `buildContext` (normalizing media, dates, relations), the corresponding endpoints.
- **Tests**: `DataSchema` snapshots for representative collections; no sensitive field ever appears; context for a post including its author.
- **Acceptance criteria**: `users` fields never appear in the schema.
- **Risks**: Payload field-config API changes — mitigated by a pinned peer version and dedicated tests.

## PB-098 - `PayloadDataSource` and data endpoints - L

- **Purpose**: queries and media from the CMS (see `docs/dynamic-bindings.md`).
- **Dependencies**: PB-097, PB-026
- **Files**: `packages/payload/src/data/{payload-data-source,where}.ts`, `plugin/endpoints/data.ts`
- **Implementation**: `QuerySpec` to Payload `where` (an allowlist for fields and sorts, a limit), `excludeCurrent`, pagination, batched media lookups (`id in`), the `data/query` and `data/media` endpoints.
- **Tests**: **the shared `DataSource` contract tests from PB-026**; attempted queries against non-allowlisted fields (rejected).
- **Acceptance criteria**: matches `MemoryDataSource` behavior under the contract tests.
- **Risks**: none.

## PB-099 - Media endpoints - M

- **Purpose**: the picker and uploads (see `docs/payload.md`).
- **Dependencies**: PB-095
- **Files**: `packages/payload/src/plugin/endpoints/media.ts`, `data/normalize-media.ts`
- **Implementation**: listing, search, a type filter, upload (multipart -> Local API, `alt` required), normalization to `MediaAsset`.
- **Tests**: integration (an upload with no `alt` returns 422).
- **Acceptance criteria**: the contract is captured in `contract.ts`.
- **Risks**: hosting-imposed upload size limits (serverless environments) — documented.

## PB-100 - The HTTP adapter (`@buildr/payload/adapter`) - M

- **Purpose**: how the editor and canvas talk to Payload.
- **Dependencies**: PB-095, PB-097, PB-098, PB-099, PB-087
- **Files**: `packages/payload/src/adapter/{document-adapter,canvas-data-source,http}.ts`
- **Implementation**: `createPayloadAdapter({ baseUrl })` -> a `DocumentAdapter`; `createPayloadCanvasDataSource({ baseUrl })` -> a `DataSource`; response validation against the contract; mapping 409/422 onto result types.
- **Tests**: unit tests with a mocked `fetch`; a boundary test confirming no import of `payload`.
- **Acceptance criteria**: works in the browser with no polyfills.
- **Risks**: none.

## PB-101 - The templates collection and `resolveLayout` - M

- **Purpose**: collection-level layouts (MVP scenarios 3 and 5).
- **Dependencies**: PB-093
- **Files**: `packages/payload/src/plugin/collections/templates.ts`, `data/resolve-layout.ts`
- **Implementation**: `buildr-templates` (drafts, exactly one `isDefault` per `targetCollection`), `resolveLayout` (see `docs/payload.md`), surfacing the layout's source in the "get document" response.
- **Tests**: resolution order; two `isDefault` entries (the second is rejected).
- **Acceptance criteria**: a post with no layout of its own renders through its template.
- **Risks**: none.

## PB-102 - Forms: collection and endpoint - L

- **Purpose**: MVP scenario 6 (see `docs/security.md`, "Forms").
- **Dependencies**: PB-095, PB-061
- **Files**: `packages/payload/src/plugin/{collections/form-submissions,endpoints/forms}.ts`
- **Implementation**: `buildr-form-submissions`; an endpoint (requires `registry` in the plugin options): the published document (or its template) -> the form node -> `deriveFormSchema` -> validation; a honeypot; rate limiting (an interface plus an in-memory implementation); email notification (Payload's `sendEmail`, an allowlisted recipient set); JSON for `fetch` submissions, a 303 redirect for no-JS submissions.
- **Tests**: valid and invalid data, fields outside the schema rejected, honeypot behavior, 429, a form on a draft document being unreachable publicly.
- **Acceptance criteria**: the client can never change what fields the form schema accepts.
- **Risks**: the in-memory rate limiter does not work across serverless instances (documented; the interface allows a Redis-backed implementation).

## PB-116 - Payload: localization in the plugin - M

- **Purpose**: locale-aware data and configuration from Payload (see `docs/i18n.md`, `docs/payload.md`).
- **Dependencies**: PB-095, PB-097, PB-098
- **Files**: `packages/payload/src/plugin/{locales.ts,endpoints/*}`, `src/data/build-context.ts`
- **Implementation**: `LocaleConfig` derived from `config.localization` (a single-locale fallback when localization isn't configured); `locales` in the session response; a `locale` parameter on `documents` GET, `data/*`, `media`, `samples` (mapped to Local API's `locale`/`fallbackLocale`); `route.locale` in the context; `locale` recorded on form submissions; validating `l10n` keys in the hook against `LocaleConfig`.
- **Tests**: SQLite integration with `pl`/`en`: context for a post in both languages, fallback behavior, an unknown locale returning 400.
- **Acceptance criteria**: an installation with no localization configured behaves unchanged (a single locale).
- **Risks**: Local API's exact `fallbackLocale` behavior — verified by dedicated tests.
