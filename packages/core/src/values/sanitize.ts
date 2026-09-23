import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';

const ALLOWED_URL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

/**
 * Strips ASCII C0 controls (codes 0x00 through 0x1F) and DEL (0x7F) — never meaningful in a URL,
 * often used to split a blocked scheme across a naive filter (`java\tscript:`, `java\nscript:`).
 * A plain code-point scan rather than a control-character regex class, which Biome's
 * `noControlCharactersInRegex` rejects outright (even escaped), with no per-line exception used
 * elsewhere in this codebase.
 */
function stripControlChars(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code > 0x1f && code !== 0x7f) result += char;
  }
  return result;
}

const NUMERIC_ENTITY = /&#(\d+);?/g;
const HEX_ENTITY = /&#x([0-9a-f]+);?/gi;
// A small, deliberately narrow set of named entities that can reconstruct URL syntax
// (a colon, an ampersand, ...) when decoded by an HTML parser downstream.
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  colon: ':',
  num: '#',
  commat: '@',
  sol: '/',
  quest: '?',
  semi: ';',
  Tab: '\t',
  NewLine: '\n',
};
const NAMED_ENTITY = new RegExp(`&(${Object.keys(NAMED_ENTITIES).join('|')});?`, 'g');

const PERCENT_ENCODED = /%[0-9a-f]{2}/gi;

const MAX_DECODE_PASSES = 5;

function decodeEntitiesOnce(value: string): string {
  return value
    .replace(NUMERIC_ENTITY, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(HEX_ENTITY, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(NAMED_ENTITY, (_, name: string) => NAMED_ENTITIES[name] ?? '');
}

function percentDecodeOnce(value: string): string {
  return value.replace(PERCENT_ENCODED, (sequence) => {
    try {
      return decodeURIComponent(sequence);
    } catch {
      return sequence;
    }
  });
}

/**
 * The scheme an HTML parser would eventually see once every layer of obfuscation (control
 * characters, HTML entities, percent-encoding — each of which can hide across multiple rounds of
 * decoding) is stripped away. Used only to *detect* a dangerous scheme; the sanitized value
 * returned by `sanitizeUrl` is never this decoded form.
 */
function detectScheme(value: string): string | undefined {
  let current = value;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass++) {
    const decoded = stripControlChars(percentDecodeOnce(decodeEntitiesOnce(current)));
    if (decoded === current) break;
    current = decoded;
  }
  const match = /^\s*([a-z][a-z0-9+.-]*):/i.exec(current);
  return match?.[1]?.toLowerCase();
}

/**
 * Validates and normalizes a URL against the scheme allowlist from docs/security.md
 * (`http`, `https`, `mailto`, `tel`, plus relative paths and `#anchor`). Rejects `javascript:`,
 * `data:`, `vbscript:`, any other unknown scheme, and obfuscated variants of the above (control
 * characters, HTML entity encoding, percent-encoding, case variation). Never throws — a URL is
 * document data, not a programmer-controlled literal.
 */
export function sanitizeUrl(url: string): Result<string, Diagnostic> {
  const sanitized = stripControlChars(url).trim();
  const scheme = detectScheme(sanitized);

  if (scheme !== undefined && !ALLOWED_URL_SCHEMES.has(scheme)) {
    return err({
      code: 'url.unsafe-scheme',
      message: `URL scheme "${scheme}" is not allowed`,
      severity: 'error',
      details: { scheme },
    });
  }

  return ok(sanitized);
}

/** Truncates `value` to at most `maxLength` UTF-16 code units. Never throws. */
export function capString(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, Math.max(0, maxLength)) : value;
}
