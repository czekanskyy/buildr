import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isJsonValue, type JsonValue } from '../json/json-value.ts';
import { getPath, MAX_PATH_DEPTH, parsePath } from './path.ts';

describe('parsePath', () => {
  it('parses a simple dotted path', () => {
    const result = parsePath('post.author.name');
    expect(result).toEqual({
      ok: true,
      value: [
        { kind: 'key', key: 'post' },
        { kind: 'key', key: 'author' },
        { kind: 'key', key: 'name' },
      ],
    });
  });

  it('parses numeric-literal array indices', () => {
    const result = parsePath('post.images[0].alt');
    expect(result).toEqual({
      ok: true,
      value: [
        { kind: 'key', key: 'post' },
        { kind: 'key', key: 'images' },
        { kind: 'index', index: 0 },
        { kind: 'key', key: 'alt' },
      ],
    });
  });

  it('parses consecutive indices', () => {
    const result = parsePath('matrix[0][1]');
    expect(result).toEqual({
      ok: true,
      value: [
        { kind: 'key', key: 'matrix' },
        { kind: 'index', index: 0 },
        { kind: 'index', index: 1 },
      ],
    });
  });

  it.each(['__proto__', 'prototype', 'constructor'])('rejects "%s" as a key segment', (key) => {
    expect(parsePath(key)).toMatchObject({ ok: false, error: { code: 'path.forbidden' } });
    expect(parsePath(`post.${key}`)).toMatchObject({
      ok: false,
      error: { code: 'path.forbidden' },
    });
    expect(parsePath(`${key}.post`)).toMatchObject({
      ok: false,
      error: { code: 'path.forbidden' },
    });
  });

  it('rejects "constructor.prototype" specifically', () => {
    expect(parsePath('constructor.prototype')).toMatchObject({
      ok: false,
      error: { code: 'path.forbidden' },
    });
  });

  it.each(['', '.a', 'a.', 'a..b', 'a[0]b', 'a[b]', 'a[', 'a]', 'a b', 'a.[0]'])(
    'rejects malformed syntax: %j',
    (path) => {
      expect(parsePath(path)).toMatchObject({ ok: false, error: { code: 'path.syntax' } });
    },
  );

  it('rejects a path deeper than MAX_PATH_DEPTH', () => {
    const tooDeep = Array.from({ length: MAX_PATH_DEPTH + 1 }, (_, i) => `a${i}`).join('.');
    expect(parsePath(tooDeep)).toMatchObject({ ok: false, error: { code: 'path.syntax' } });
  });

  it('accepts a path exactly at MAX_PATH_DEPTH', () => {
    const atLimit = Array.from({ length: MAX_PATH_DEPTH }, (_, i) => `a${i}`).join('.');
    const result = parsePath(atLimit);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toHaveLength(MAX_PATH_DEPTH);
  });

  it('never throws for arbitrary input', () => {
    fc.assert(
      fc.property(fc.string(), (path) => {
        expect(() => parsePath(path)).not.toThrow();
      }),
    );
  });
});

describe('getPath', () => {
  it('reads a nested own property', () => {
    const scopes = { post: { author: { name: 'Ada' } } };
    expect(getPath(scopes, 'post.author.name')).toBe('Ada');
  });

  it('reads through an array index', () => {
    const scopes = { post: { images: [{ alt: 'first' }, { alt: 'second' }] } };
    expect(getPath(scopes, 'post.images[1].alt')).toBe('second');
  });

  it('resolves a missing key to undefined', () => {
    expect(getPath({ post: { title: 'Hi' } }, 'post.subtitle')).toBeUndefined();
  });

  it('resolves an out-of-range index to undefined', () => {
    expect(getPath({ items: [1, 2] }, 'items[5]')).toBeUndefined();
  });

  it('resolves an index against a non-array to undefined', () => {
    expect(getPath({ post: { title: 'Hi' } }, 'post[0]')).toBeUndefined();
  });

  it('resolves a key against a non-object to undefined', () => {
    expect(getPath({ post: 'Hi' }, 'post.title')).toBeUndefined();
  });

  it('resolves a key against null to undefined', () => {
    expect(getPath({ post: null }, 'post.title')).toBeUndefined();
  });

  it('resolves a key against an array to undefined (arrays are not indexed by key)', () => {
    expect(getPath({ items: [1, 2] }, 'items.length')).toBeUndefined();
  });

  it('never reads an inherited (non-own) property', () => {
    const scopes = { post: Object.create({ inherited: 'nope' }) };
    scopes.post.own = 'yes';
    expect(getPath(scopes, 'post.own')).toBe('yes');
    expect(getPath(scopes, 'post.inherited')).toBeUndefined();
  });

  it.each(['__proto__', 'constructor', 'prototype', 'constructor.prototype'])(
    'never resolves "%s"',
    (path) => {
      expect(getPath({}, path)).toBeUndefined();
      expect(getPath({ a: { b: 1 } }, `a.${path}`)).toBeUndefined();
    },
  );

  it('resolves a malformed path to undefined instead of throwing', () => {
    expect(getPath({ a: 1 }, 'a..b')).toBeUndefined();
    expect(getPath({ a: 1 }, '')).toBeUndefined();
  });

  it('never returns undefined for a value actually stored as undefined-like null', () => {
    expect(getPath({ a: null }, 'a')).toBeNull();
  });

  it('never throws for arbitrary scopes and path strings', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.jsonValue()), fc.string(), (scopes, path) => {
        expect(() => getPath(scopes as Record<string, JsonValue>, path)).not.toThrow();
      }),
    );
  });

  it('property: the result is always undefined or a plain JsonValue, never a prototype value', () => {
    const maliciousKey = fc.constantFrom('__proto__', 'constructor', 'prototype', 'a', 'b');
    const pathArbitrary = fc
      .array(
        fc.oneof(
          maliciousKey,
          fc.nat({ max: 5 }).map((n) => `[${n}]`),
        ),
        { minLength: 1, maxLength: 6 },
      )
      .map((segments) =>
        segments
          .reduce((path, segment, index) => {
            if (segment.startsWith('[')) return path + segment;
            return index === 0 ? segment : `${path}.${segment}`;
          }, '')
          .replace(/^\./, ''),
      );

    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.jsonValue()), pathArbitrary, (scopes, path) => {
        const result = getPath(scopes as Record<string, JsonValue>, path);
        const isSafe =
          result === undefined ||
          (isJsonValue(result) &&
            result !== Object.prototype &&
            result !== Array.prototype &&
            typeof result !== 'function');
        expect(isSafe).toBe(true);
      }),
    );
  });
});
