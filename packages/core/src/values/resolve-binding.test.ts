import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DataContext } from '../data/context.ts';
import { bind } from './helpers.ts';
import { resolveBinding } from './resolve-binding.ts';

function baseContext(scopes: DataContext['scopes'] = {}): DataContext {
  return {
    scopes,
    locale: 'en',
    locales: { default: 'en', fallback: true, intl: { en: 'English', pl: 'Polski' } },
    timeZone: 'UTC',
    mode: 'production',
  };
}

describe('resolveBinding', () => {
  it('resolves an existing path with no diagnostics', () => {
    const ctx = baseContext({ post: { title: 'Hello' } });
    const result = resolveBinding(bind('post.title'), ctx);

    expect(result).toEqual({ value: 'Hello', diagnostics: [] });
  });

  it('resolves a nested path through an array index', () => {
    const ctx = baseContext({ post: { images: [{ alt: 'A cat' }] } });
    const result = resolveBinding(bind('post.images[0].alt'), ctx);

    expect(result).toEqual({ value: 'A cat', diagnostics: [] });
  });

  it('falls back to the binding fallback when the path is missing, with a diagnostic', () => {
    const ctx = baseContext({ post: {} });
    const result = resolveBinding(bind('post.title', { fallback: 'Untitled' }), ctx);

    expect(result.value).toBe('Untitled');
    expect(result.diagnostics).toEqual([
      {
        code: 'binding.missing',
        message: 'binding path "post.title" did not resolve to a value',
        severity: 'warning',
        details: { path: 'post.title' },
      },
    ]);
  });

  it('resolves to undefined with a diagnostic when missing and there is no fallback', () => {
    const ctx = baseContext({ post: {} });
    const result = resolveBinding(bind('post.title'), ctx);

    expect(result.value).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe('binding.missing');
  });

  it('treats a malformed path as missing rather than throwing', () => {
    const ctx = baseContext({ post: { title: 'Hello' } });
    const result = resolveBinding(bind('post.__proto__.title', { fallback: 'safe' }), ctx);

    expect(result.value).toBe('safe');
    expect(result.diagnostics[0]?.code).toBe('binding.missing');
  });

  it('treats an out-of-range index as missing', () => {
    const ctx = baseContext({ post: { images: [] } });
    const result = resolveBinding(bind('post.images[0]'), ctx);

    expect(result.value).toBeUndefined();
    expect(result.diagnostics[0]?.code).toBe('binding.missing');
  });

  it('resolves falsy-but-defined values without treating them as missing', () => {
    const ctx = baseContext({ post: { count: 0, published: false, note: '' } });

    expect(resolveBinding(bind('post.count'), ctx).value).toBe(0);
    expect(resolveBinding(bind('post.published'), ctx).value).toBe(false);
    expect(resolveBinding(bind('post.note'), ctx).value).toBe('');
  });

  it('never throws for arbitrary paths and scopes', () => {
    fc.assert(
      fc.property(fc.string(), fc.dictionary(fc.string(), fc.jsonValue()), (path, scopes) => {
        const ctx = baseContext(scopes as DataContext['scopes']);
        expect(() => resolveBinding(bind(path), ctx)).not.toThrow();
      }),
    );
  });
});
