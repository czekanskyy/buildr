import type { JsonValue } from '../json/json-value.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';

/** A single step of a parsed binding path: a `.key` segment or a `[n]` numeric index. */
export type PathSegment =
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'index'; readonly index: number };

/**
 * The max number of segments a path may have (docs/dynamic-bindings.md#resolution) — bounds
 * `getPath`'s walk and doubles as the recursion cap for `schemaAtPath`/`listPaths`, which face the
 * same "how deep can this go" question over `DataSchema` instead of over live data.
 */
export const MAX_PATH_DEPTH = 12;

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Segment names that must never resolve, on any object, at any depth — the classic
 * prototype-pollution trio. Rejected here, at parse time, rather than relying solely on
 * `getPath`'s `Object.hasOwn` guard, so the rejection is a documented, independently-tested
 * property of every path string rather than an emergent side effect of how lookups happen to walk.
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function syntaxError(path: string, detail: string): Result<never, Diagnostic> {
  return err({
    code: 'path.syntax',
    message: `Invalid binding path "${path}": ${detail}.`,
    severity: 'error',
  });
}

/**
 * Parses a binding path such as `post.author.name` or `post.images[0].alt`
 * (docs/dynamic-bindings.md#resolution) into segments, rejecting anything that isn't a plain
 * chain of `.key` / `[digits]` steps — including `__proto__`, `prototype`, `constructor` at any
 * position, and a total depth beyond `MAX_PATH_DEPTH`. Never throws: any malformed input is an
 * `Err`, never an exception, since a path is data (authored in the editor, stored in the
 * document) rather than a programmer-controlled literal.
 */
export function parsePath(path: string): Result<readonly PathSegment[], Diagnostic> {
  if (path.length === 0) return syntaxError(path, 'path must not be empty');

  const segments: PathSegment[] = [];
  let i = 0;
  // A path is a key, then any run of `.key` / `[digits]` steps: it must start with a key, `.`
  // must always be followed by a key (never `[`, never another `.`, never the end), and `[` may
  // only follow a completed segment (a key or a `]`), never a `.`.
  let state: 'key' | 'separator-or-end' = 'key';

  while (i < path.length) {
    const ch = path[i];

    if (state === 'key') {
      if (ch === '.' || ch === '[') return syntaxError(path, `expected a key, found "${ch}"`);
      let end = i;
      while (end < path.length && path[end] !== '.' && path[end] !== '[') end += 1;
      const key = path.slice(i, end);
      if (!KEY_PATTERN.test(key)) return syntaxError(path, `"${key}" is not a valid path segment`);
      if (FORBIDDEN_KEYS.has(key)) {
        return err({
          code: 'path.forbidden',
          message: `Invalid binding path "${path}": "${key}" is never allowed in a binding path.`,
          severity: 'error',
        });
      }
      segments.push({ kind: 'key', key });
      i = end;
      state = 'separator-or-end';
      continue;
    }

    if (ch === '.') {
      i += 1;
      state = 'key';
      continue;
    }

    if (ch === '[') {
      const close = path.indexOf(']', i + 1);
      if (close === -1) return syntaxError(path, 'unterminated "["');
      const digits = path.slice(i + 1, close);
      if (!/^\d+$/.test(digits)) return syntaxError(path, '"[...]" must contain a numeric index');
      segments.push({ kind: 'index', index: Number(digits) });
      i = close + 1;
      continue;
    }

    return syntaxError(path, `expected "." or "[", found "${ch}"`);
  }

  if (state === 'key') return syntaxError(path, 'trailing "."');
  if (segments.length > MAX_PATH_DEPTH) {
    return syntaxError(path, `path depth exceeds the maximum of ${MAX_PATH_DEPTH}`);
  }

  return ok(segments);
}

/**
 * Resolves `path` against `scopes` (docs/dynamic-bindings.md#resolution). Only own properties are
 * ever read (`Object.hasOwn`), on top of `parsePath` already rejecting `__proto__`/`prototype`/
 * `constructor` outright, so no value from a prototype chain can ever come back. Never throws: a
 * malformed path, a missing key, an out-of-range index, or indexing into the wrong shape (e.g. a
 * `[n]` step against a plain object) all resolve to `undefined`, exactly like a genuinely missing
 * value — the caller (the binding resolver, PB-021) is the one that turns "missing" into a
 * diagnostic and a fallback.
 */
export function getPath(
  scopes: Readonly<Record<string, JsonValue>>,
  path: string,
): JsonValue | undefined {
  const parsed = parsePath(path);
  if (!parsed.ok) return undefined;

  let current: JsonValue = scopes;
  for (const segment of parsed.value) {
    if (segment.kind === 'index') {
      if (!Array.isArray(current)) return undefined;
      const value: JsonValue | undefined = current[segment.index];
      if (value === undefined) return undefined;
      current = value;
    } else {
      if (typeof current !== 'object' || current === null || Array.isArray(current))
        return undefined;
      if (!Object.hasOwn(current, segment.key)) return undefined;
      const value: JsonValue | undefined = (current as Record<string, JsonValue>)[segment.key];
      if (value === undefined) return undefined;
      current = value;
    }
  }
  return current;
}
