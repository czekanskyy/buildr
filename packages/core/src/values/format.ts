import type { JsonValue } from '../json/json-value.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import { capString } from './sanitize.ts';
import type { FormatSpec, LocaleCode } from './types.ts';

/** The locale/time zone a `FormatSpec` is applied under (docs/dynamic-bindings.md#resolution, step 4) — the slice of `DataContext` that formatting actually needs. */
export interface FormatContext {
  readonly locale: LocaleCode;
  readonly timeZone: string;
}

function typeMismatch(spec: FormatSpec, value: JsonValue): Diagnostic {
  return {
    code: 'binding.type-mismatch',
    message: `format type "${spec.type}" cannot be applied to ${typeof value === 'object' && value !== null ? (Array.isArray(value) ? 'an array' : 'an object') : typeof value} value`,
    severity: 'warning',
    details: { formatType: spec.type },
  };
}

/**
 * Runs `fn`, turning any thrown error (an invalid `currency` code, an unrecognized `timeZone` —
 * both only knowable once `Intl` actually tries to use them) into a `Diagnostic` instead. Formats
 * are authored data (a `FormatSpec` on a `BindingValue`), not programmer-controlled literals, so a
 * bad one must never throw (docs/ai/architecture-rules.md #7).
 */
function tryFormat(spec: FormatSpec, fn: () => string): Result<string, Diagnostic> {
  try {
    return ok(fn());
  } catch (error) {
    return err({
      code: 'format.invalid-spec',
      message: `formatting with type "${spec.type}" failed: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'warning',
      details: { formatType: spec.type },
    });
  }
}

/** Parses a JSON-safe date representation (an ISO string, or an epoch-millis number) — `DataContext.scopes` never holds a `Date` instance. `undefined` for anything that doesn't parse to a valid instant. */
function toDate(value: JsonValue): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.slice(0, 1).toUpperCase() + value.slice(1);
}

function formatText(value: string, spec: Extract<FormatSpec, { type: 'text' }>): string {
  let result = value;
  if (spec.transform === 'upper') result = result.toUpperCase();
  else if (spec.transform === 'lower') result = result.toLowerCase();
  else if (spec.transform === 'capitalize') result = capitalize(result);
  return spec.truncate === undefined ? result : capString(result, spec.truncate);
}

/**
 * Renders `value` as a display string per `spec`, using `ctx.locale`/`ctx.timeZone` for the
 * `Intl`-backed formats (docs/dynamic-bindings.md#the-value-model). Never throws: a value whose
 * runtime shape doesn't match `spec.type` (e.g. a boolean handed to `{ type: 'number' }`), or a
 * `spec` that `Intl` itself rejects, produces a `Diagnostic` instead of a result.
 */
export function formatValue(
  value: JsonValue,
  spec: FormatSpec,
  ctx: FormatContext,
): Result<string, Diagnostic> {
  switch (spec.type) {
    case 'date': {
      const date = toDate(value);
      if (date === undefined) return err(typeMismatch(spec, value));
      const style = spec.style;
      if (style === 'iso') return tryFormat(spec, () => date.toISOString());
      return tryFormat(spec, () =>
        new Intl.DateTimeFormat(ctx.locale, { dateStyle: style, timeZone: ctx.timeZone }).format(
          date,
        ),
      );
    }
    case 'number': {
      if (typeof value !== 'number') return err(typeMismatch(spec, value));
      return tryFormat(spec, () =>
        new Intl.NumberFormat(ctx.locale, {
          style: spec.style ?? 'decimal',
          ...(spec.minimumFractionDigits !== undefined
            ? { minimumFractionDigits: spec.minimumFractionDigits }
            : {}),
          ...(spec.maximumFractionDigits !== undefined
            ? { maximumFractionDigits: spec.maximumFractionDigits }
            : {}),
        }).format(value),
      );
    }
    case 'currency': {
      if (typeof value !== 'number') return err(typeMismatch(spec, value));
      return tryFormat(spec, () =>
        new Intl.NumberFormat(ctx.locale, { style: 'currency', currency: spec.currency }).format(
          value,
        ),
      );
    }
    case 'text': {
      if (typeof value !== 'string') return err(typeMismatch(spec, value));
      return ok(formatText(value, spec));
    }
  }
}
