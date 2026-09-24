import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';

export const TOKEN_SCALES = [
  'color',
  'space',
  'radius',
  'shadow',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'container',
  'transition',
] as const;
export type TokenScale = (typeof TOKEN_SCALES)[number];

export const LENGTH_UNITS = ['px', 'rem', 'em', '%', 'vw', 'vh', 'svh', 'dvh', 'ch', 'fr'] as const;
export type LengthUnit = (typeof LENGTH_UNITS)[number];

/** Max length of any style value, in characters. */
export const MAX_STYLE_VALUE_LENGTH = 200;
/** Magnitude limit of any number in a style value. */
const MAX_MAGNITUDE = 100_000;

/**
 * What a property accepts, as plain data (so the registry stays serializable). Every grammar
 * parses to a CSS text that is safe to place after `property:` — see `parseStyleValue`.
 */
export type StyleGrammar =
  /** A token, a keyword, a length and/or a bare number — any subset. */
  | {
      readonly kind: 'composite';
      readonly tokens?: readonly TokenScale[];
      readonly keywords?: readonly string[];
      readonly length?: {
        readonly units: readonly LengthUnit[];
        readonly negative?: boolean;
      };
      readonly number?: {
        readonly min: number;
        readonly max: number;
        readonly integer?: boolean;
      };
    }
  | { readonly kind: 'color'; readonly keywords?: readonly string[] }
  | { readonly kind: 'ratio' }
  | { readonly kind: 'gradient' }
  /** `columns` / `rows`: an integer 1..12 for that many equal tracks. */
  | { readonly kind: 'gridTrack' }
  /** `columnSpan`: an integer 1..12. */
  | { readonly kind: 'gridSpan' }
  /** `true` compiles to `none` (used by `visibility.hidden`), `false` to the empty string. */
  | { readonly kind: 'boolean' }
  /** A `box-shadow` value: up to 4 layers of `[inset] <x> <y> [<blur> [<spread>]] <color>` (theme tokens only). */
  | { readonly kind: 'shadow' }
  /** A `font-family` stack of plain family names and generic families (theme tokens only). */
  | { readonly kind: 'fontFamily' }
  /** A `transition` list: `[property] <duration> [timing] [delay]` (theme tokens only). */
  | { readonly kind: 'transition' };

export interface ParseOptions {
  /** Whether the property is naturally inherited, which is the only case `inherit` is accepted. */
  readonly inheritable?: boolean;
}

/** Characters and sequences no style value may contain, whatever the grammar (docs/styles.md#value-grammar-per-property-never-free-form-css). */
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
const FORBIDDEN_CHARS = /[;{}\\<>"'`@\u0000-\u001f\u007f]/;
const FORBIDDEN_WORDS =
  /(?:url|var|calc|expression|image-set|attr|env)\s*\(|!\s*important|\/\*|\*\/|javascript:/i;

function fail(message: string, input: unknown): Result<never, Diagnostic> {
  const shown = typeof input === 'string' ? input.slice(0, 40) : typeof input;
  return err({
    code: 'style.invalid-value',
    message: `${message} (got ${typeof input === 'string' ? `"${shown}"` : shown}).`,
    severity: 'error',
  });
}

const TOKEN = /^\$([A-Za-z]+)\.([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const LENGTH = /^(-?\d+(?:\.\d{1,4})?)(px|rem|em|%|vw|vh|svh|dvh|ch|fr)$/;
const NUMBER = /^-?\d+(?:\.\d{1,4})?$/;

function kebab(scale: string): string {
  return scale.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** `$space.4` → `var(--b-space-4)`; `undefined` when the scale is not one of `allowed`. */
function parseToken(input: string, allowed: readonly TokenScale[]): string | undefined {
  const match = TOKEN.exec(input);
  if (match === null) return undefined;
  const scale = match[1] as TokenScale;
  if (!allowed.includes(scale)) return undefined;
  return `var(--b-${kebab(scale)}-${match[2]})`;
}

function isSafeNumber(value: number): boolean {
  return (
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_MAGNITUDE &&
    Math.round(value * 1e4) / 1e4 === value
  );
}

function parseComposite(
  grammar: Extract<StyleGrammar, { kind: 'composite' }>,
  input: unknown,
): string | undefined {
  if (typeof input === 'number') {
    if (grammar.length !== undefined && input === 0) return '0';
    const spec = grammar.number;
    if (spec === undefined || !isSafeNumber(input)) return undefined;
    if (input < spec.min || input > spec.max) return undefined;
    if (spec.integer === true && !Number.isInteger(input)) return undefined;
    return String(input);
  }
  if (typeof input !== 'string') return undefined;

  if (input.startsWith('$')) {
    return grammar.tokens === undefined ? undefined : parseToken(input, grammar.tokens);
  }
  if (grammar.keywords?.includes(input) === true) return input;

  const spec = grammar.length;
  if (spec !== undefined) {
    if (input === '0') return '0';
    const match = LENGTH.exec(input);
    if (match !== null) {
      const value = Number(match[1]);
      const unit = match[2] as LengthUnit;
      if (!spec.units.includes(unit)) return undefined;
      if (value < 0 && spec.negative !== true) return undefined;
      if (Math.abs(value) > MAX_MAGNITUDE) return undefined;
      return `${value === 0 ? 0 : value}${unit}`;
    }
  }
  return undefined;
}

function describeComposite(grammar: Extract<StyleGrammar, { kind: 'composite' }>): string {
  const parts: string[] = [];
  if (grammar.tokens !== undefined)
    parts.push(`a token (${grammar.tokens.map((s) => `$${s}.…`).join(', ')})`);
  if (grammar.keywords !== undefined && grammar.keywords.length > 0) {
    parts.push(`one of ${grammar.keywords.join(', ')}`);
  }
  if (grammar.length !== undefined) {
    parts.push(
      `a length (${grammar.length.units.join(', ')}${grammar.length.negative === true ? '; may be negative' : ''})`,
    );
  }
  if (grammar.number !== undefined) {
    parts.push(
      `a number from ${grammar.number.min} to ${grammar.number.max}${grammar.number.integer === true ? ' (whole)' : ''}`,
    );
  }
  return `expected ${parts.join(' or ')}`;
}

// --- colors -----------------------------------------------------------------------------------

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_FN = /^(rgba?|hsla?|oklch)\(([^()]*)\)$/;

/** A finite number in `[min, max]`, or a percentage of `max`. */
function component(raw: string, min: number, max: number, percentOf?: number): number | undefined {
  const isPercent = raw.endsWith('%');
  const text = isPercent ? raw.slice(0, -1) : raw;
  if (!NUMBER.test(text)) return undefined;
  let value = Number(text);
  if (isPercent) {
    if (percentOf === undefined) return undefined;
    if (value < 0 || value > 100) return undefined;
    value = (value / 100) * percentOf;
  }
  return value >= min && value <= max ? Math.round(value * 1e4) / 1e4 : undefined;
}

function alpha(raw: string | undefined): string | undefined | null {
  if (raw === undefined) return undefined;
  const value = component(raw, 0, 1, 1);
  return value === undefined ? null : String(value);
}

function parseColorFunction(input: string): string | undefined {
  const match = COLOR_FN.exec(input);
  if (match === null) return undefined;
  const name = (match[1] as string).replace(/a$/, '');
  const body = (match[2] as string).trim();
  // Modern `a b c / alpha` or legacy `a, b, c[, alpha]`.
  let channels: string[];
  let alphaRaw: string | undefined;
  if (body.includes(',')) {
    if (body.includes('/')) return undefined;
    const parts = body.split(',').map((p) => p.trim());
    if (parts.length !== 3 && parts.length !== 4) return undefined;
    channels = parts.slice(0, 3);
    alphaRaw = parts[3];
  } else {
    const [main, a, ...extra] = body.split('/').map((p) => p.trim());
    if (extra.length > 0 || main === undefined) return undefined;
    channels = main.split(/\s+/);
    alphaRaw = a;
    if (channels.length !== 3) return undefined;
  }
  const a = alpha(alphaRaw);
  if (a === null) return undefined;
  const suffix = a === undefined ? '' : ` / ${a}`;

  if (name === 'rgb') {
    const rgb = channels.map((c) => component(c, 0, 255, 255));
    return rgb.every((v) => v !== undefined) ? `rgb(${rgb.join(' ')}${suffix})` : undefined;
  }
  if (name === 'hsl') {
    const [h, s, l] = channels as [string, string, string];
    const hue = component(h.replace(/deg$/, ''), 0, 360);
    const sat = s.endsWith('%') ? component(s, 0, 100, 100) : undefined;
    const light = l.endsWith('%') ? component(l, 0, 100, 100) : undefined;
    if (hue === undefined || sat === undefined || light === undefined) return undefined;
    return `hsl(${hue} ${sat}% ${light}%${suffix})`;
  }
  const [l, c, h] = channels as [string, string, string];
  const lightness = component(l, 0, 1, 1);
  const chroma = component(c, 0, 0.5);
  const hue = component(h.replace(/deg$/, ''), 0, 360);
  if (lightness === undefined || chroma === undefined || hue === undefined) return undefined;
  return `oklch(${lightness} ${chroma} ${hue}${suffix})`;
}

function parseColor(input: string, keywords?: readonly string[]): string | undefined {
  if (input.startsWith('$')) return parseToken(input, ['color']);
  if (keywords?.includes(input) === true) return input;
  if (HEX.test(input)) return input.toLowerCase();
  return parseColorFunction(input);
}

// --- gradients --------------------------------------------------------------------------------

const DIRECTION = /^to (?:top|bottom|left|right)(?: (?:left|right|top|bottom))?$/;
const STOP = /^(.+?)(?: (\d{1,3}(?:\.\d{1,2})?%))?$/;

/** Splits on commas outside parentheses. */
function splitTopLevel(text: string): string[] | undefined {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth < 0) return undefined;
    } else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (depth !== 0) return undefined;
  parts.push(text.slice(start).trim());
  return parts;
}

function parseGradient(input: string): string | undefined {
  if (input === 'none') return 'none';
  const match = /^linear-gradient\((.*)\)$/.exec(input);
  if (match === null) return undefined;
  const parts = splitTopLevel(match[1] as string);
  if (parts === undefined) return undefined;

  let direction = '180deg';
  const first = parts[0] as string;
  if (DIRECTION.test(first)) {
    direction = first;
    parts.shift();
  } else if (/^-?\d{1,3}(?:\.\d{1,2})?deg$/.test(first)) {
    const degrees = Number(first.slice(0, -3));
    if (Math.abs(degrees) > 360) return undefined;
    direction = `${degrees}deg`;
    parts.shift();
  }
  if (parts.length < 2 || parts.length > 8) return undefined;

  const stops: string[] = [];
  for (const part of parts) {
    const stop = STOP.exec(part);
    if (stop === null) return undefined;
    const color = parseColor((stop[1] as string).trim());
    if (color === undefined) return undefined;
    const position = stop[2];
    if (position !== undefined && Number(position.slice(0, -1)) > 100) return undefined;
    stops.push(position === undefined ? color : `${color} ${position}`);
  }
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
}

// --- theme-only grammars (shadow, font stack, transition) -------------------------------------

/** Splits on spaces outside parentheses. */
function splitSpaces(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ' ' && depth === 0) {
      if (current !== '') parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current !== '') parts.push(current);
  return parts;
}

const SHADOW_LENGTH: Extract<StyleGrammar, { kind: 'composite' }> = {
  kind: 'composite',
  length: { units: ['px', 'rem', 'em'], negative: true },
};

function parseShadowLayer(layer: string): string | undefined {
  const words = splitSpaces(layer);
  const out: string[] = [];
  if (words[0] === 'inset') out.push(words.shift() as string);
  const color = words.pop();
  if (color === undefined || words.length < 2 || words.length > 4) return undefined;
  for (const [i, word] of words.entries()) {
    const length = parseComposite(SHADOW_LENGTH, word);
    // A blur radius cannot be negative.
    if (length === undefined || (i === 2 && length.startsWith('-'))) return undefined;
    out.push(length);
  }
  const parsedColor = parseColor(color);
  if (parsedColor === undefined) return undefined;
  out.push(parsedColor);
  return out.join(' ');
}

function parseShadow(input: string): string | undefined {
  if (input === 'none') return 'none';
  const layers = splitTopLevel(input);
  if (layers === undefined || layers.length > 4) return undefined;
  const parsed = layers.map(parseShadowLayer);
  return parsed.every((layer) => layer !== undefined) ? parsed.join(', ') : undefined;
}

const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
]);
const GLOBAL_KEYWORDS = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'default',
]);
const FAMILY_NAME = /^[A-Za-z][A-Za-z0-9-]{0,39}(?: [A-Za-z0-9-]{1,40}){0,4}$/;

function parseFontFamily(input: string): string | undefined {
  const families = input.split(',').map((family) => family.trim());
  if (families.length > 8) return undefined;
  for (const family of families) {
    if (GENERIC_FAMILIES.has(family)) continue;
    if (!FAMILY_NAME.test(family) || GLOBAL_KEYWORDS.has(family.toLowerCase())) return undefined;
  }
  return families.join(', ');
}

const TRANSITION_PROPERTIES = new Set([
  'all',
  'color',
  'background-color',
  'border-color',
  'box-shadow',
  'opacity',
  'transform',
]);
const TIMING = new Set(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear']);
const TIME = /^(\d+(?:\.\d{1,3})?)(ms|s)$/;

function milliseconds(word: string): number | undefined {
  const match = TIME.exec(word);
  if (match === null) return undefined;
  const value = Number(match[1]) * (match[2] === 's' ? 1000 : 1);
  return value <= 5000 ? value : undefined;
}

function parseTransitionLayer(layer: string): string | undefined {
  const words = splitSpaces(layer);
  const out: string[] = [];
  const property = words[0];
  if (property !== undefined && TRANSITION_PROPERTIES.has(property))
    out.push(words.shift() as string);
  const duration = words.shift();
  if (duration === undefined || milliseconds(duration) === undefined) return undefined;
  out.push(duration);
  if (words[0] !== undefined && TIMING.has(words[0])) out.push(words.shift() as string);
  const delay = words.shift();
  if (delay !== undefined) {
    if (milliseconds(delay) === undefined) return undefined;
    out.push(delay);
  }
  return words.length === 0 ? out.join(' ') : undefined;
}

function parseTransition(input: string): string | undefined {
  if (input === 'none') return 'none';
  const layers = splitTopLevel(input);
  if (layers === undefined || layers.length > 4) return undefined;
  const parsed = layers.map(parseTransitionLayer);
  return parsed.every((layer) => layer !== undefined) ? parsed.join(', ') : undefined;
}

// --- the rest ---------------------------------------------------------------------------------

const RATIO = /^(\d+(?:\.\d{1,4})?)\s*\/\s*(\d+(?:\.\d{1,4})?)$/;

function parseRatio(input: unknown): string | undefined {
  if (typeof input === 'number') {
    return isSafeNumber(input) && input > 0 && input <= 100 ? String(input) : undefined;
  }
  if (typeof input !== 'string') return undefined;
  if (input === 'auto') return 'auto';
  const match = RATIO.exec(input);
  if (match === null) return undefined;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return a > 0 && b > 0 && a <= 100 && b <= 100 ? `${a} / ${b}` : undefined;
}

function parseCount(input: unknown, max: number): number | undefined {
  return typeof input === 'number' && Number.isInteger(input) && input >= 1 && input <= max
    ? input
    : undefined;
}

/**
 * Parses `input` against `grammar` and returns the CSS text to emit after `property:` — never the
 * input itself, always a normalized re-rendering. This is what makes CSS injection impossible:
 * a value is either rejected or rebuilt from parsed parts, so the result can never contain `;`,
 * braces, quotes, backslashes, comments, `url()`, `var()` supplied by the author, `calc()`,
 * `expression()` or `!important`. (The only `var()` in a result is the one a `$scale.name` token
 * compiles to.) Never throws.
 */
export function parseStyleValue(
  grammar: StyleGrammar,
  input: unknown,
  options?: ParseOptions,
): Result<string, Diagnostic> {
  if (typeof input === 'string') {
    if (input.length === 0) return fail('a value must not be empty', input);
    if (input.length > MAX_STYLE_VALUE_LENGTH) {
      return fail(`a value is limited to ${MAX_STYLE_VALUE_LENGTH} characters`, input);
    }
    if (FORBIDDEN_CHARS.test(input) || FORBIDDEN_WORDS.test(input)) {
      return fail('the value contains characters or functions that are never allowed', input);
    }
    if (input !== input.trim()) return fail('a value must not start or end with whitespace', input);
    if (input === 'inherit' && options?.inheritable === true) return ok('inherit');
  }

  switch (grammar.kind) {
    case 'composite': {
      const css = parseComposite(grammar, input);
      return css === undefined ? fail(describeComposite(grammar), input) : ok(css);
    }
    case 'color': {
      const css = typeof input === 'string' ? parseColor(input, grammar.keywords) : undefined;
      return css === undefined
        ? fail('expected a color token ($color.…), #hex, rgb(), hsl() or oklch()', input)
        : ok(css);
    }
    case 'ratio': {
      const css = parseRatio(input);
      return css === undefined
        ? fail('expected a ratio like "16 / 9", a number or auto', input)
        : ok(css);
    }
    case 'gradient': {
      const css = typeof input === 'string' ? parseGradient(input) : undefined;
      return css === undefined
        ? fail('expected none or linear-gradient(<angle|to side>, <color> [<n>%], ...)', input)
        : ok(css);
    }
    case 'gridTrack': {
      const count = parseCount(input, 12);
      return count === undefined
        ? fail('expected a whole number of tracks from 1 to 12', input)
        : ok(`repeat(${count}, minmax(0, 1fr))`);
    }
    case 'gridSpan': {
      const count = parseCount(input, 12);
      return count === undefined
        ? fail('expected a whole number of columns from 1 to 12', input)
        : ok(`span ${count}`);
    }
    case 'shadow':
    case 'fontFamily':
    case 'transition': {
      const parse =
        grammar.kind === 'shadow'
          ? parseShadow
          : grammar.kind === 'fontFamily'
            ? parseFontFamily
            : parseTransition;
      const css = typeof input === 'string' ? parse(input) : undefined;
      return css === undefined ? fail(`expected a valid ${grammar.kind} value`, input) : ok(css);
    }
    case 'boolean':
      return typeof input === 'boolean'
        ? ok(input ? 'none' : '')
        : fail('expected true or false', input);
  }
}
