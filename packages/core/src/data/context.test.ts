import { describe, expect, it } from 'vitest';
import type { DataContext } from './context.ts';
import { pushScope } from './context.ts';

function baseContext(): DataContext {
  return {
    scopes: { site: { name: 'Acme' }, page: { title: 'Home' } },
    locale: 'en',
    locales: { default: 'en', fallback: true, intl: { en: 'English', pl: 'Polski' } },
    timeZone: 'UTC',
    mode: 'production',
  };
}

describe('pushScope', () => {
  it('adds a new scope alongside the existing ones', () => {
    const ctx = baseContext();
    const next = pushScope(ctx, { item: { id: 1 } });

    expect(next.scopes).toEqual({ ...ctx.scopes, item: { id: 1 } });
  });

  it('replaces a scope of the same name (nested Loop shadowing)', () => {
    const ctx = pushScope(baseContext(), { item: { id: 'outer' }, index: 0 });
    const inner = pushScope(ctx, { item: { id: 'inner' }, index: 1 });

    expect(inner.scopes.item).toEqual({ id: 'inner' });
    expect(inner.scopes.index).toBe(1);
    expect(inner.scopes.site).toEqual({ name: 'Acme' });
  });

  it('does not mutate the original context', () => {
    const ctx = baseContext();
    const original = ctx.scopes;
    pushScope(ctx, { item: { id: 1 } });

    expect(ctx.scopes).toBe(original);
  });

  it('leaves every other field untouched', () => {
    const ctx = baseContext();
    const next = pushScope(ctx, { item: { id: 1 } });

    expect(next.locale).toBe(ctx.locale);
    expect(next.locales).toBe(ctx.locales);
    expect(next.timeZone).toBe(ctx.timeZone);
    expect(next.mode).toBe(ctx.mode);
  });
});
