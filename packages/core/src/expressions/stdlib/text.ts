import type { JsonValue } from '../../json/json-value.ts';
import { MAX_RESULT_TEXT, StdlibArgError, type StdlibFunction, stringify } from './types.ts';

const COMBINING_MARKS = /\p{M}+/gu;
const NON_ALNUM = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const DEFAULT_SUFFIX = '…';

/** Latin letters NFKD does not decompose, so `slugify('Łódź')` is `lodz` and not `odz`. */
const TRANSLITERATION: Readonly<Record<string, string>> = {
  ł: 'l',
  đ: 'd',
  ø: 'o',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  þ: 'th',
  ð: 'd',
};

function nonNegativeInteger(value: JsonValue, what: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new StdlibArgError(`${what} must be a non-negative integer`);
  }
  return value;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

export const textFunctions: readonly StdlibFunction[] = [
  {
    name: 'upper',
    returns: 'string',
    params: [{ type: 'string' }],
    doc: 'upper(s) — the text in upper case',
    run: ([s]) => (s as string).toUpperCase(),
  },
  {
    name: 'lower',
    returns: 'string',
    params: [{ type: 'string' }],
    doc: 'lower(s) — the text in lower case',
    run: ([s]) => (s as string).toLowerCase(),
  },
  {
    name: 'capitalize',
    returns: 'string',
    params: [{ type: 'string' }],
    doc: 'capitalize(s) — the first letter in upper case',
    run: ([s]) => {
      const text = s as string;
      const first = text.codePointAt(0);
      if (first === undefined) return text;
      const head = String.fromCodePoint(first);
      return head.toUpperCase() + text.slice(head.length);
    },
  },
  {
    name: 'trim',
    returns: 'string',
    params: [{ type: 'string' }],
    doc: 'trim(s) — the text without leading and trailing whitespace',
    run: ([s]) => (s as string).trim(),
  },
  {
    name: 'truncate',
    returns: 'string',
    params: [{ type: 'string' }, { type: 'number' }, { type: 'string', optional: true }],
    doc: 'truncate(s, n, suffix?) — at most n characters including the suffix (default "…")',
    run: ([s, n, suffix]) => {
      const text = s as string;
      const max = nonNegativeInteger(n as JsonValue, 'the length');
      const tail = suffix === undefined ? DEFAULT_SUFFIX : (suffix as string);
      if (text.length <= max) return text;
      if (tail.length >= max) return tail.slice(0, max);
      let end = max - tail.length;
      // Never cut a surrogate pair in half.
      if (end > 0 && isHighSurrogate(text.charCodeAt(end - 1))) end -= 1;
      return text.slice(0, end) + tail;
    },
  },
  {
    name: 'concat',
    returns: 'string',
    params: [],
    rest: { type: 'any' },
    doc: 'concat(...) — the arguments joined as text; null counts as empty',
    run: (args) => {
      let out = '';
      for (const arg of args) {
        const part = stringify(arg);
        if (part === undefined) throw new StdlibArgError('cannot concatenate a list or an object');
        out += part;
        if (out.length > MAX_RESULT_TEXT) break;
      }
      return out;
    },
  },
  {
    name: 'replace',
    returns: 'string',
    params: [{ type: 'string' }, { type: 'string' }, { type: 'string' }],
    doc: 'replace(s, find, repl) — every literal occurrence of find replaced (not a regex)',
    run: ([s, find, repl], env) => {
      const text = s as string;
      env.charge(text.length);
      if (find === '') return text;
      return text.split(find as string).join(repl as string);
    },
  },
  {
    name: 'slugify',
    returns: 'string',
    params: [{ type: 'string' }],
    doc: 'slugify(s) — lower-case ASCII words joined by dashes',
    run: ([s], env) => {
      const text = s as string;
      env.charge(text.length);
      const lowered = text.normalize('NFKD').replace(COMBINING_MARKS, '').toLowerCase();
      let ascii = '';
      for (const ch of lowered) ascii += TRANSLITERATION[ch] ?? ch;
      return ascii.replace(NON_ALNUM, '-').replace(EDGE_DASHES, '');
    },
  },
  {
    name: 'len',
    returns: 'number',
    params: [{ type: 'any' }],
    doc: 'len(x) — the length of a text (UTF-16 units) or a list; null is 0',
    run: ([x]) => {
      const value = x as JsonValue;
      if (value === null) return 0;
      if (typeof value === 'string' || Array.isArray(value)) return value.length;
      throw new StdlibArgError('len expects a text or a list');
    },
  },
];
