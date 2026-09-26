import type { JsonValue } from '../json/json-value.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import type { FormatContext } from './format.ts';
import { formatValue } from './format.ts';
import { normalizeRichText, plainTextToRichText } from './richtext.ts';
import { sanitizeUrl } from './sanitize.ts';
import type { FormatSpec } from './types.ts';

/**
 * The prop kinds a resolved binding/expression value can target (docs/dynamic-bindings.md#data-
 * types-and-the-data-schema) — the "Prop kind" column of the coercion table. A deliberately
 * narrower, local union rather than the full `PropDef['kind']` from `@next-buildr/core/schema`: kinds
 * with an empty `accepts` (`textarea`, `select`, `icon`, `list`, `object`) are never bindable, so
 * they never reach a coercion.
 */
export type CoercibleKind =
  | 'text'
  | 'link'
  | 'media'
  | 'richText'
  | 'boolean'
  | 'number'
  | 'listSource';

/** The outcome of `coerceValue` — always *some* best-effort value plus whatever went wrong producing it, never a hard failure (docs/dynamic-bindings.md#resolution, step 4). `value: undefined` signals the caller to continue down the fallback chain (step 6). */
export interface CoercedValue {
  readonly value: JsonValue | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

function typeMismatch(kind: CoercibleKind, value: JsonValue): Diagnostic {
  const shape =
    value === null
      ? 'null'
      : Array.isArray(value)
        ? 'an array'
        : typeof value === 'object'
          ? 'an object'
          : typeof value;
  return {
    code: 'binding.type-mismatch',
    message: `prop kind "${kind}" cannot accept ${shape} value`,
    severity: 'warning',
    details: { kind },
  };
}

function coerceToText(
  raw: JsonValue,
  ctx: FormatContext,
  format: FormatSpec | undefined,
): CoercedValue {
  if (format !== undefined) {
    const result = formatValue(raw, format, ctx);
    return result.ok
      ? { value: result.value, diagnostics: [] }
      : { value: undefined, diagnostics: [result.error] };
  }
  if (typeof raw === 'string') return { value: raw, diagnostics: [] };
  if (typeof raw === 'number') {
    // "a default Intl format" (docs/dynamic-bindings.md#data-types-and-the-data-schema) — a plain
    // `date` value can't get the same default, since a JSON-safe date is just a string
    // (`DataContext.scopes` never holds a `Date` instance) indistinguishable at this point from an
    // ordinary text value; only an explicit `format` can request date formatting.
    try {
      return { value: new Intl.NumberFormat(ctx.locale).format(raw), diagnostics: [] };
    } catch (error) {
      return {
        value: undefined,
        diagnostics: [
          {
            code: 'format.invalid-spec',
            message: `default number formatting failed: ${error instanceof Error ? error.message : String(error)}`,
            severity: 'warning',
          },
        ],
      };
    }
  }
  return { value: undefined, diagnostics: [typeMismatch('text', raw)] };
}

function coerceToLink(raw: JsonValue): CoercedValue {
  if (typeof raw !== 'string')
    return { value: undefined, diagnostics: [typeMismatch('link', raw)] };
  const sanitized = sanitizeUrl(raw);
  return sanitized.ok
    ? { value: sanitized.value, diagnostics: [] }
    : { value: undefined, diagnostics: [sanitized.error] };
}

function coerceToRichText(raw: JsonValue): CoercedValue {
  // `RichTextRootNode`'s literal-typed fields (`type: 'root'`, ...) aren't structurally a
  // `JsonValue` to TS (no index signature), though every value they hold is plain JSON —
  // `registry/manifest.ts` casts through the same gap.
  if (typeof raw === 'string') {
    return { value: plainTextToRichText(raw) as unknown as JsonValue, diagnostics: [] };
  }
  const normalized = normalizeRichText(raw);
  return { value: normalized.value as unknown as JsonValue, diagnostics: normalized.diagnostics };
}

function coerceToPrimitive(kind: 'boolean' | 'number', raw: JsonValue): CoercedValue {
  return typeof raw === kind
    ? { value: raw, diagnostics: [] }
    : { value: undefined, diagnostics: [typeMismatch(kind, raw)] };
}

/**
 * Coerces a raw resolved value (from `resolveBinding` or, later, an expression result) to the
 * shape `kind` expects, per the coercion table in docs/dynamic-bindings.md#data-types-and-the-
 * data-schema. Only `text` (through `format`, or a default `Intl` format for a number), `link`
 * (`sanitizeUrl`), and `richText` (a bare string becomes a single paragraph; anything else goes
 * through the safe walker) do any real work — `boolean`/`number` require an exact runtime-type
 * match, and `media`/`listSource` pass the value through untouched, since their shape is validated
 * elsewhere. Never throws: a value that doesn't fit `kind` produces `binding.type-mismatch`
 * (docs/dynamic-bindings.md#resolution, step 6) rather than an exception.
 */
export function coerceValue(
  raw: JsonValue,
  kind: CoercibleKind,
  ctx: FormatContext,
  format?: FormatSpec,
): CoercedValue {
  switch (kind) {
    case 'text':
      return coerceToText(raw, ctx, format);
    case 'link':
      return coerceToLink(raw);
    case 'richText':
      return coerceToRichText(raw);
    case 'boolean':
      return coerceToPrimitive('boolean', raw);
    case 'number':
      return coerceToPrimitive('number', raw);
    case 'media':
    case 'listSource':
      return { value: raw, diagnostics: [] };
  }
}
