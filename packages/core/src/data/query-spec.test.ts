import { describe, expect, it } from 'vitest';
import { bind, expr, s } from '../values/helpers.ts';
import { querySpecSchema, resolvedQuerySpecSchema } from './query-spec.ts';

const ok = (spec: unknown) => querySpecSchema.safeParse(spec).success;
const leaf = (field = 'title') => ({ field, op: 'eq', value: s('x') });

describe('querySpecSchema', () => {
  it('accepts a full spec', () => {
    expect(
      ok({
        source: 'posts',
        limit: 10,
        where: {
          and: [
            leaf(),
            { or: [leaf('author.name'), { field: 'n', op: 'gt', value: bind('route.params.n') }] },
          ],
        },
        sort: [{ field: 'publishedAt', dir: 'desc' }],
        page: expr('route.params.page'),
        excludeCurrent: true,
      }),
    ).toBe(true);
  });

  it.each([
    ['no limit', { source: 'posts' }],
    ['limit 0', { source: 'posts', limit: 0 }],
    ['limit over 50', { source: 'posts', limit: 51 }],
    ['fractional limit', { source: 'posts', limit: 1.5 }],
    ['bad source', { source: 'a b', limit: 1 }],
    ['proto source', { source: '__proto__ x', limit: 1 }],
    ['unknown key', { source: 'posts', limit: 1, extra: true }],
    ['bad op', { source: 'posts', limit: 1, where: { field: 'a', op: 'like', value: s(1) } }],
    ['prototype field', { source: 'posts', limit: 1, where: leaf('__proto__') }],
    ['bad field syntax', { source: 'posts', limit: 1, where: leaf('a b') }],
    ['bad sort field', { source: 'posts', limit: 1, sort: [{ field: 'constructor', dir: 'asc' }] }],
    ['bad sort dir', { source: 'posts', limit: 1, sort: [{ field: 'a', dir: 'up' }] }],
    [
      'too many sort keys',
      {
        source: 'posts',
        limit: 1,
        sort: Array.from({ length: 5 }, () => ({ field: 'a', dir: 'asc' })),
      },
    ],
    ['empty and', { source: 'posts', limit: 1, where: { and: [] } }],
    ['raw operand', { source: 'posts', limit: 1, where: { field: 'a', op: 'eq', value: 5 } }],
  ])('rejects %s', (_name, spec) => {
    expect(ok(spec)).toBe(false);
  });

  it('limits filter nesting and size', () => {
    let nested: unknown = leaf();
    for (let i = 0; i < 4; i += 1) nested = { and: [nested] };
    expect(ok({ source: 'posts', limit: 1, where: nested })).toBe(true);
    nested = { and: [nested] };
    expect(ok({ source: 'posts', limit: 1, where: nested })).toBe(false);

    const wide = { or: Array.from({ length: 32 }, () => leaf()) };
    expect(ok({ source: 'posts', limit: 1, where: wide })).toBe(false); // 33 nodes with the group
    expect(
      ok({ source: 'posts', limit: 1, where: { or: Array.from({ length: 31 }, () => leaf()) } }),
    ).toBe(true);
  });
});

describe('resolvedQuerySpecSchema', () => {
  it('validates the resolved form', () => {
    const good = {
      source: 'posts',
      limit: 5,
      page: 2,
      where: { field: 'a', op: 'in', value: [1, 2] },
      excludeId: 'x',
    };
    expect(resolvedQuerySpecSchema.safeParse(good).success).toBe(true);
    expect(resolvedQuerySpecSchema.safeParse({ ...good, page: 0 }).success).toBe(false);
    expect(
      resolvedQuerySpecSchema.safeParse({ ...good, where: { field: 'a', op: 'like', value: 1 } })
        .success,
    ).toBe(false);
  });
});
