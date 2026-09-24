---
"@buildr/core": minor
---

Add the binding resolver and formatters (PB-021): `resolveBinding(binding, ctx)` reads `binding.path` off `DataContext.scopes` via `getPath` (PB-019), applying the binding's own `fallback` and emitting a `binding.missing` diagnostic when the path doesn't resolve.

`coerceValue(raw, kind, ctx, format?)` implements the coercion table from `docs/dynamic-bindings.md`: `text` renders through an explicit `format`, or a default `Intl` number format, or passes a string through unchanged; `link` runs through `sanitizeUrl`; `richText` wraps a bare string in a single paragraph (`plainTextToRichText`) or walks anything else through `normalizeRichText`; `boolean`/`number` require an exact runtime-type match; `media`/`listSource` pass through untouched. A mismatch never throws — it produces a `binding.type-mismatch` diagnostic and an `undefined` value for the caller to fall back from.

`formatValue(value, spec, ctx)` renders a value as a display string per `FormatSpec` using `Intl.DateTimeFormat`/`Intl.NumberFormat` with `ctx.locale`/`ctx.timeZone`, plus a plain text transform/truncate path. Never throws: a value that doesn't match `spec.type`, or a `spec` that `Intl` itself rejects (an unrecognized `timeZone`, an invalid currency code), becomes a diagnostic instead of an exception.
