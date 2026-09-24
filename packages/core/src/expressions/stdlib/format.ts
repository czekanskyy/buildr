import type { JsonValue } from '../../json/json-value.ts';
import { StdlibArgError, type StdlibEnv, type StdlibFunction } from './types.ts';

const DATE_STYLES: readonly string[] = ['short', 'medium', 'long', 'iso'];
const NUMBER_STYLES: readonly string[] = ['decimal', 'percent'];
const PLURAL_CATEGORIES: readonly Intl.LDMLPluralRule[] = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
];

/** Runs an  call, turning what it throws (an unknown currency or locale) into a recoverable argument error. */
function intl(fn: () => string): string {
  try {
    return fn();
  } catch (error) {
    throw new StdlibArgError(error instanceof Error ? error.message : 'invalid format');
  }
}

function formatNumber(value: number, options: Intl.NumberFormatOptions, env: StdlibEnv): string {
  return intl(() => new Intl.NumberFormat(env.locale, options).format(value));
}

function formatDate(value: JsonValue, style: string, env: StdlibEnv): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new StdlibArgError('a date must be an ISO string or epoch milliseconds');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new StdlibArgError('not a valid date');
  if (style === 'iso') return date.toISOString();
  return intl(() =>
    new Intl.DateTimeFormat(env.locale, {
      dateStyle: style as 'short' | 'medium' | 'long',
      timeZone: env.timeZone,
    }).format(date),
  );
}

function digitsOption(opts: Readonly<Record<string, JsonValue>>, key: string): number | undefined {
  const value = opts[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 20) {
    throw new StdlibArgError(`${key} must be an integer from 0 to 20`);
  }
  return value;
}

function numberOptions(
  opts: Readonly<Record<string, JsonValue>> | undefined,
): Intl.NumberFormatOptions {
  if (opts === undefined) return {};
  const style = opts['style'];
  if (style !== undefined && (typeof style !== 'string' || !NUMBER_STYLES.includes(style))) {
    throw new StdlibArgError('style must be "decimal" or "percent"');
  }
  const min = digitsOption(opts, 'minimumFractionDigits');
  const max = digitsOption(opts, 'maximumFractionDigits');
  return {
    ...(style === undefined ? {} : { style: style as 'decimal' | 'percent' }),
    ...(min === undefined ? {} : { minimumFractionDigits: min }),
    ...(max === undefined ? {} : { maximumFractionDigits: max }),
  };
}

export const formatFunctions: readonly StdlibFunction[] = [
  {
    name: 'formatNumber',
    returns: 'string',
    params: [{ type: 'number' }, { type: 'object', optional: true }],
    doc: "formatNumber(n, opts?) — n in the locale's number format; opts: style, minimumFractionDigits, maximumFractionDigits",
    run: ([n, opts], env) =>
      formatNumber(
        n as number,
        numberOptions(opts as Readonly<Record<string, JsonValue>> | undefined),
        env,
      ),
  },
  {
    name: 'formatCurrency',
    returns: 'string',
    params: [{ type: 'number' }, { type: 'string' }],
    doc: 'formatCurrency(n, currency) — n as money in an ISO 4217 currency, e.g. "PLN"',
    run: ([n, currency], env) =>
      formatNumber(n as number, { style: 'currency', currency: currency as string }, env),
  },
  {
    name: 'formatDate',
    returns: 'string',
    params: [{ type: 'any' }, { type: 'string' }],
    doc: "formatDate(d, style) — an ISO date string or epoch milliseconds as 'short' | 'medium' | 'long' | 'iso'",
    run: ([d, style], env) => {
      if (d === null || d === undefined) return null;
      if (!DATE_STYLES.includes(style as string)) {
        throw new StdlibArgError('style must be "short", "medium", "long" or "iso"');
      }
      return formatDate(d, style as string, env);
    },
  },
  {
    name: 'plural',
    returns: 'string',
    params: [{ type: 'number' }, { type: 'object' }],
    doc: "plural(n, { one, few, many, other }) — the form for n per the locale's plural rules (`other` is required)",
    run: ([n, forms], env) => {
      const table = forms as Readonly<Record<string, JsonValue>>;
      for (const key of Object.keys(table)) {
        if (!PLURAL_CATEGORIES.includes(key as Intl.LDMLPluralRule)) {
          throw new StdlibArgError(`"${key}" is not a plural category`);
        }
        if (typeof table[key] !== 'string') {
          throw new StdlibArgError(`the "${key}" form must be a text`);
        }
      }
      if (typeof table['other'] !== 'string')
        throw new StdlibArgError('the "other" form is required');
      let category: Intl.LDMLPluralRule;
      try {
        category = new Intl.PluralRules(env.locale).select(n as number);
      } catch (error) {
        throw new StdlibArgError(error instanceof Error ? error.message : 'invalid locale');
      }
      const form = Object.hasOwn(table, category) ? table[category] : undefined;
      return typeof form === 'string' ? form : table['other'];
    },
  },
];
