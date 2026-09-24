import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import { parseStyleValue, type StyleGrammar, TOKEN_SCALES, type TokenScale } from './grammar.ts';
import { MAX_STYLE_BREAKPOINTS } from './schema.ts';

export interface Breakpoint {
  /** `'tablet'`, `'mobile'`, ... — the key of `NodeStyles.bp`. */
  readonly id: string;
  /** The largest viewport width (px) the breakpoint applies to. */
  readonly maxWidth: number;
}

/** The tokens of one scale: name to a value written in that scale's grammar. */
export type TokenValues = Readonly<Record<string, string | number>>;

/** What `defineTheme` takes. Every scale is optional; a scale left out has no tokens. */
export interface ThemeInput {
  /** Widest first (desktop-first): each `maxWidth` must be smaller than the one before. */
  readonly breakpoints: readonly Breakpoint[];
  readonly tokens: Readonly<Partial<Record<TokenScale, TokenValues>>>;
}

/** A validated theme: token values are normalized CSS text, and the whole object is frozen. */
export interface Theme {
  readonly breakpoints: readonly Breakpoint[];
  readonly tokens: Readonly<Record<TokenScale, Readonly<Record<string, string>>>>;
}

export const MAX_TOKENS_PER_SCALE = 64;
const TOKEN_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TOKEN_NAME_LENGTH = 32;
const BREAKPOINT_ID = /^[a-z][a-z0-9-]{0,31}$/;
const MIN_BREAKPOINT_WIDTH = 240;
const MAX_BREAKPOINT_WIDTH = 4096;

const LENGTH = (units: readonly ('px' | 'rem' | 'em' | '%')[], negative = false): StyleGrammar => ({
  kind: 'composite',
  length: { units, negative },
  keywords: [],
});

/**
 * What a token value must look like, per scale. Token values may not refer to other tokens
 * (`$...`), so there are no reference cycles to resolve.
 */
const VALUE_GRAMMARS: Readonly<Record<TokenScale, StyleGrammar>> = {
  color: { kind: 'color' },
  space: LENGTH(['px', 'rem', 'em']),
  radius: LENGTH(['px', 'rem', 'em', '%']),
  shadow: { kind: 'shadow' },
  fontFamily: { kind: 'fontFamily' },
  fontSize: LENGTH(['px', 'rem', 'em']),
  fontWeight: { kind: 'composite', number: { min: 100, max: 900, integer: true } },
  lineHeight: {
    kind: 'composite',
    number: { min: 0.5, max: 5 },
    length: { units: ['px', 'rem', 'em'] },
  },
  container: LENGTH(['px', 'rem', 'em', '%']),
  transition: { kind: 'transition' },
};

function invalid(path: string, message: string): Diagnostic {
  return {
    code: 'theme.invalid',
    message: `${path}: ${message}`,
    severity: 'error',
    path: path.split('.'),
  };
}

function normalizeValue(scale: TokenScale, raw: string | number): Result<string, string> {
  // A numeric string is a number (`"700"`), so fontWeight can be written either way.
  const value =
    typeof raw === 'string' &&
    /^\d+(\.\d+)?$/.test(raw) &&
    (scale === 'fontWeight' || scale === 'lineHeight')
      ? Number(raw)
      : raw;
  if (typeof value === 'string' && value.startsWith('$')) {
    return err('a token value cannot refer to another token');
  }
  const parsed = parseStyleValue(VALUE_GRAMMARS[scale], value);
  return parsed.ok ? ok(parsed.value) : err(parsed.error.message);
}

/**
 * Validates a theme without throwing (docs/styles.md#theme-and-tokens): breakpoint ids, strictly
 * decreasing widths, token names and every token value against its scale's grammar. The same
 * check will validate untrusted token overrides from v0.2. All problems are reported, each with
 * a `path` such as `tokens.color.primary`.
 */
export function validateTheme(input: ThemeInput): Result<Theme, readonly Diagnostic[]> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return err([invalid('theme', 'must be an object with breakpoints and tokens')]);
  }
  const problems: Diagnostic[] = [];

  const breakpoints: Breakpoint[] = [];
  if (!Array.isArray(input.breakpoints)) {
    problems.push(invalid('breakpoints', 'must be a list'));
  } else {
    if (input.breakpoints.length > MAX_STYLE_BREAKPOINTS) {
      problems.push(invalid('breakpoints', `at most ${MAX_STYLE_BREAKPOINTS} breakpoints`));
    }
    const seen = new Set<string>();
    let previous = Number.POSITIVE_INFINITY;
    for (const [i, bp] of input.breakpoints.entries()) {
      const at = `breakpoints.${i}`;
      if (typeof bp?.id !== 'string' || !BREAKPOINT_ID.test(bp.id)) {
        problems.push(
          invalid(at, 'id must be lower-case letters, digits and dashes, starting with a letter'),
        );
        continue;
      }
      if (seen.has(bp.id)) problems.push(invalid(at, `duplicate breakpoint "${bp.id}"`));
      seen.add(bp.id);
      if (
        !Number.isInteger(bp.maxWidth) ||
        bp.maxWidth < MIN_BREAKPOINT_WIDTH ||
        bp.maxWidth > MAX_BREAKPOINT_WIDTH
      ) {
        problems.push(
          invalid(
            at,
            `maxWidth must be a whole number from ${MIN_BREAKPOINT_WIDTH} to ${MAX_BREAKPOINT_WIDTH}`,
          ),
        );
        continue;
      }
      if (bp.maxWidth >= previous) {
        problems.push(
          invalid(at, 'breakpoints must be listed widest first with strictly decreasing maxWidth'),
        );
      }
      previous = bp.maxWidth;
      breakpoints.push({ id: bp.id, maxWidth: bp.maxWidth });
    }
  }

  const tokens = Object.fromEntries(
    TOKEN_SCALES.map((scale) => [scale, {} as Record<string, string>]),
  ) as Record<TokenScale, Record<string, string>>;
  let given: Record<string, unknown> = {};
  if (typeof input.tokens !== 'object' || input.tokens === null || Array.isArray(input.tokens)) {
    problems.push(invalid('tokens', 'must be an object'));
  } else {
    given = { ...input.tokens };
  }
  for (const scale of Object.keys(given)) {
    if (!(TOKEN_SCALES as readonly string[]).includes(scale)) {
      problems.push(
        invalid(
          `tokens.${scale}`,
          `unknown token scale (expected one of ${TOKEN_SCALES.join(', ')})`,
        ),
      );
    }
  }
  for (const scale of TOKEN_SCALES) {
    const values = given[scale];
    if (values === undefined) continue;
    if (typeof values !== 'object' || values === null || Array.isArray(values)) {
      problems.push(invalid(`tokens.${scale}`, 'must be an object of token values'));
      continue;
    }
    const entries = Object.entries(values as Record<string, unknown>);
    if (entries.length > MAX_TOKENS_PER_SCALE) {
      problems.push(invalid(`tokens.${scale}`, `at most ${MAX_TOKENS_PER_SCALE} tokens`));
    }
    for (const [name, raw] of entries) {
      const at = `tokens.${scale}.${name}`;
      if (!TOKEN_NAME.test(name) || name.length > MAX_TOKEN_NAME_LENGTH) {
        problems.push(
          invalid(at, 'a token name is lower-case letters and digits, joined by single dashes'),
        );
        continue;
      }
      if (typeof raw !== 'string' && typeof raw !== 'number') {
        problems.push(invalid(at, 'a token value must be a string or a number'));
        continue;
      }
      const value = normalizeValue(scale, raw);
      if (value.ok) (tokens[scale] as Record<string, string>)[name] = value.value;
      else problems.push(invalid(at, value.error));
    }
  }

  if (problems.length > 0) return err(problems);
  const frozen = Object.fromEntries(
    TOKEN_SCALES.map((scale) => [scale, Object.freeze({ ...tokens[scale] })]),
  ) as Theme['tokens'];
  return ok(
    Object.freeze({
      breakpoints: Object.freeze(breakpoints.map((bp) => Object.freeze(bp))),
      tokens: Object.freeze(frozen),
    }),
  );
}

/**
 * Builds a theme from code (trusted input). An invalid theme is an authoring mistake, so this
 * throws with every problem listed; use `validateTheme` for input you do not control.
 */
export function defineTheme(input: ThemeInput): Theme {
  const result = validateTheme(input);
  if (!result.ok) {
    throw new Error(
      `defineTheme: invalid theme — ${result.error.map((d) => d.message).join('; ')}`,
    );
  }
  return result.value;
}

/** The theme every document starts from (docs/styles.md#theme-and-tokens). */
export const defaultTheme: Theme = defineTheme({
  breakpoints: [
    { id: 'tablet', maxWidth: 1023 },
    { id: 'mobile', maxWidth: 767 },
  ],
  tokens: {
    color: {
      primary: '#2563eb',
      'on-primary': '#ffffff',
      surface: '#ffffff',
      'surface-alt': '#f3f4f6',
      text: '#111827',
      'text-muted': '#4b5563',
      border: '#d1d5db',
      focus: '#1d4ed8',
      danger: '#b91c1c',
      success: '#15803d',
    },
    space: {
      0: '0',
      1: '0.25rem',
      2: '0.5rem',
      3: '0.75rem',
      4: '1rem',
      6: '1.5rem',
      8: '2rem',
      12: '3rem',
      16: '4rem',
      24: '6rem',
    },
    radius: { none: '0', sm: '0.25rem', md: '0.5rem', lg: '1rem', full: '9999px' },
    shadow: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.08)',
      md: '0 4px 8px rgba(0, 0, 0, 0.12)',
      lg: '0 12px 24px rgba(0, 0, 0, 0.16)',
    },
    fontFamily: {
      body: 'system-ui, sans-serif',
      heading: 'system-ui, sans-serif',
      mono: 'ui-monospace, monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
    },
    fontWeight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 },
    container: { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem' },
    transition: { fast: '150ms ease', normal: '250ms ease' },
  },
});
