# Dynamic bindings

See also [ADR-004](adr/ADR-004-dynamic-binding.md).

## The value model

```ts
export type Value<T = unknown> = StaticValue<T> | BindingValue<T> | ExpressionValue<T>;

export interface StaticValue<T>     { kind: 'static';     value: T; l10n?: Partial<Record<LocaleCode, T>> }
export interface BindingValue<T>    { kind: 'binding';    path: string; format?: FormatSpec; fallback?: T }
export interface ExpressionValue<T> { kind: 'expression'; expr: string; mode?: 'formula' | 'template';
                                       l10n?: Partial<Record<LocaleCode, string>>;   // template mode only
                                       fallback?: T }

export type FormatSpec =
  | { type: 'date'; style: 'short' | 'medium' | 'long' | 'iso' }
  | { type: 'number'; minimumFractionDigits?: number; maximumFractionDigits?: number; style?: 'decimal' | 'percent' }
  | { type: 'currency'; currency: string }
  | { type: 'text'; transform?: 'upper' | 'lower' | 'capitalize'; truncate?: number };
```

The discriminator is `kind`, not `type`, to avoid confusion with `node.type`. `static` is deliberately wrapped rather than being a bare value: this makes the union explicit and unambiguous when parsing untrusted JSON, and keeps a resolver's `switch (value.kind)` the single dispatch point everywhere. `l10n` carries per-locale overrides for otherwise localizable static/template values — see [i18n.md](i18n.md).

`binding` covers roughly 90% of real cases: picking a field off the data tree, simple type checking, easy path refactors during migrations. `expression` handles the advanced cases. `mode: 'template'` is free text with `{{ ... }}` segments interpolated.

There is no separate "update binding" command — a binding is just a prop's value, set via `node.setProp` with a `BindingValue`.

## Data types and the data schema

```ts
export type DataType =
  | { t: 'string' } | { t: 'number' } | { t: 'boolean' } | { t: 'date' } | { t: 'url' }
  | { t: 'richText' } | { t: 'media' } | { t: 'link' } | { t: 'enum'; values: string[] }
  | { t: 'object'; fields: Record<string, DataField> }
  | { t: 'list'; of: DataType }
  | { t: 'ref'; entity: string };

export interface DataField { type: DataType; label?: string; nullable?: boolean; description?: string }
export interface DataSchema {
  scopes: Record<string, DataField>;   // site, page | post | product, route, (inside a Loop: item, index, loop)
  entities: Record<string, DataField>; // shared types (author, category, media)
}
```

Prop-kind-to-data-type compatibility (`PropDef.accepts`, checked in the editor and again at save time):

| Prop kind | Accepts | Coercion |
|---|---|---|
| `text` | string, number, date, enum, url | number/date through `format`, or a default `Intl` format |
| `link` | url, link, string | `sanitizeUrl` |
| `media` | media | none |
| `richText` | richText, string | string becomes a single paragraph |
| `boolean` | boolean | none (no truthy coercion) |
| `number` | number | none |
| `listSource` | list | none |

## Data context (runtime)

```ts
export interface DataContext {
  scopes: Readonly<Record<string, JsonValue>>;   // JSON-only: dates as ISO strings, never class instances
  locale: LocaleCode;
  locales: { default: LocaleCode; fallback: boolean; intl: Record<LocaleCode, string> };
  timeZone: string;
  mode: 'production' | 'preview' | 'canvas';
}
```

MVP scopes: `site` (global site settings), the current document under the name configured for its collection (`page` | `post` | `product`), `route` (`{ path, params, locale }`, no `searchParams` — that would break caching), and, inside a Loop, `item`/`index`/`loop` (`page`, `totalPages`, `total`) plus an optional `as` alias. A `user` scope (personalization) is explicitly out of MVP scope: it breaks caching and creates data-leak risk.

## Resolution

1. `static`: pick `l10n[ctx.locale]` (falling back to `value` when no translation exists and fallback is enabled); use `value` outright when `ctx.locale` is the default locale.
2. `binding`: `getPath(scopes, path)`, supporting `a.b.c` segments and `[n]` numeric-literal indices. Only own properties (`Object.hasOwn`) are read; `__proto__`, `prototype` and `constructor` are always rejected. Max path depth: 12. A missing value resolves to `undefined`.
3. `expression`: parse (LRU-cached by source, 500 entries) then evaluate within a step budget.
4. Coerce the result to the prop's declared type and apply `format`.
5. Validate against the prop's own validator and sanitize (URLs, length caps).
6. If the result is `undefined`/`null` or fails validation, fall back in order: `fallback` -> the prop's own `default` -> omit. Every fallback emits a `Diagnostic` (`binding.missing`, `binding.type-mismatch`, `expression.runtime`) tagged with `nodeId` and `prop`.

`resolveProps(node, meta, ctx, { cache? })` (in `@buildr/core/values`) runs this pipeline for every prop the component declares and returns `{ props, diagnostics }`; the result is plain JSON. Props the component does not declare are dropped, a missing value uses the prop's `default`, and each diagnostic carries `details.nodeId` and `details.prop`. Specifics:

- `l10n` is only consulted for `localizable` props and only when `ctx.locale` is not the default locale. With `ctx.locales.fallback` off and no translation, the prop falls back to its default and reports `l10n.missing-translation`.
- Static links go through `sanitizeUrl`, and text longer than the prop's `maxLength` is cut (`prop.truncated`). A binding or expression on a prop that is not bindable (`select`, `icon`, `list`, `object`, or `bindable: false`) is ignored with `binding.not-bindable`.
- The fallback chain is the value's own `fallback`, then the prop's `default`, then omission. A `null` result counts as missing.
- Pass a `createCompileCache()` to reuse parsed expressions across calls.

`resolveVisibility(node, ctx, { cache? })` decides `visibleIf`: no condition is visible; otherwise the resolved value's truthiness decides (`null`, `false`, `0`, `""` are falsy), so missing data hides the node. A condition that cannot be evaluated (malformed, a syntax error, a breached limit) also hides it and reports a diagnostic — it fails closed.

The resolver **never throws**. In production, diagnostics are logged once per document render; in the canvas they are streamed to the editor (tree badges, inspector chips, the Issues panel).

## Type safety, fallbacks, errors, security, UI

- **Statically (editor time)**: paths and expressions are checked against the `DataSchema` supplied by the adapter (Payload derives it from the collection's field config). A nonexistent path is an error; a coercion is a warning. Save-time validation on the server repeats this check as warnings (non-blocking, since the CMS schema can evolve independently).
- **In TypeScript (component authors)**: `p.text()` resolves to `string` in `ResolvedProps<P>` — components always receive resolved values, never raw `Value`s.
- **Invalid bindings**: the editor shows a red chip (e.g. "`post.titel` — field does not exist"), renders the fallback, and lists the issue in the Issues panel; publishing surfaces it as a warning.
- **Security**: bindings only ever read from a server-built context that already went through Payload's access control. `DataSchema` acts as an allowlist and excludes hidden/sensitive fields (`password`, `hash`, `salt`, `apiKey`, user emails, any field marked `hidden`). Values sourced from the CMS are treated as untrusted: React escapes text, URLs are sanitized, rich text goes through the safe walker.
- **Editor UI**: every bindable prop has a Static / Dynamic / Formula switch. Dynamic mode shows a `DataSchema` tree filtered to compatible types, a live preview against sample data, `format` options and a `fallback` field. Formula mode is a text field with live validation and error underlines (a plain textarea in MVP; CodeMirror 6 with autocomplete in v0.2).

## Lists and queries (Loop, Query)

The `buildr/loop` component's `source` prop (`p.listSource()`) is either `{ type: 'binding', path: 'product.images' }` (a list already present in the data) or `{ type: 'query', spec: QuerySpec }` (a collection query):

```ts
export interface QuerySpec {
  source: string;                                   // a collection alias from the adapter's allowlist ("posts")
  where?: FilterNode;                                // { and: FilterNode[] } | { or: [...] } | { field, op, value: Value }
  sort?: { field: string; dir: 'asc' | 'desc' }[];
  limit: number;                                     // <= 50
  page?: Value<number>;                              // e.g. a binding to 'route.params.page'
  excludeCurrent?: boolean;                          // for "related posts"
}
// op: 'eq' | 'neq' | 'in' | 'nin' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'exists'
```

`prepareRender(doc, registry, ctx, dataSource)` walks the document once before rendering, batches all static `MediaRef` lookups into one call, and issues every Loop `QuerySpec` with bounded concurrency. It resolves filter values from the context and returns `PreparedData { media, queries, collectionsUsed, diagnostics }` (`collectionsUsed` feeds cache tags). A Loop query that depends on the enclosing `item` (a nested dependent query) is a validation error in MVP, to keep the batching model simple and avoid N+1 patterns.

`DataSource` is the interface every environment implements: `PayloadDataSource` (server, Local API), `HttpDataSource` (canvas, via the plugin's endpoints), `MemoryDataSource` (playground/tests) — all validated by a shared contract test suite.
