import { describe, expect, it, vi } from 'vitest';
import type { DataContext } from '../data/context.ts';
import type { ResolvedQuerySpec } from '../data/query-spec.ts';
import type { DataSource, MediaAsset, QueryResult } from '../data/source.ts';
import type { BuilderDocument, PageNode } from '../document/types.ts';
import { createCompileCache } from '../expressions/compile.ts';
import type { JsonValue } from '../json/json-value.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import { p } from '../schema/p.ts';
import { bind, expr, s } from '../values/helpers.ts';
import { createMemoryDataSource } from './memory-source.ts';
import { MAX_QUERY_CONCURRENCY, prepareRender, queryKey } from './prepare.ts';
import { resolveQuerySpec } from './resolve-query.ts';

const ctx: DataContext = {
  scopes: { route: { params: { page: 2, cat: 'news' } }, site: { name: 'Buildr' } },
  locale: 'en',
  locales: { default: 'en', fallback: true, intl: {} },
  timeZone: 'UTC',
  mode: 'production',
};

const METAS: Record<string, ComponentMeta> = {
  'test/page': { type: 'test/page', props: {} } as unknown as ComponentMeta,
  'test/image': { type: 'test/image', props: { image: p.media() } } as unknown as ComponentMeta,
  'test/loop': {
    type: 'test/loop',
    props: { source: p.listSource(), as: p.text() },
  } as unknown as ComponentMeta,
};
const registry = { get: (type: string) => METAS[type] };

function makeDoc(nodes: Record<string, Partial<PageNode> & { type: string }>): BuilderDocument {
  const full: Record<string, PageNode> = {};
  for (const [id, n] of Object.entries(nodes)) full[id] = { id, ...n } as unknown as PageNode;
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: full,
    components: {},
  } as unknown as BuilderDocument;
}

const ref = (id: string, collection = 'media') => s({ source: 'mem', collection, id });
const query = (spec: Record<string, unknown>) => s({ type: 'query', spec });
const POSTS = [
  { id: 1, title: 'A', cat: 'news' },
  { id: 2, title: 'B', cat: 'news' },
  { id: 3, title: 'C', cat: 'dev' },
];
const MEDIA: Record<string, MediaAsset> = {
  m1: { id: 'm1', url: '/m1.jpg', mimeType: 'image/jpeg' },
  m2: { id: 'm2', url: '/m2.jpg', mimeType: 'image/jpeg' },
};

function spy(overrides: Partial<DataSource> = {}) {
  const base = createMemoryDataSource({ collections: { posts: POSTS }, media: MEDIA });
  const source = {
    getMedia: vi.fn(base.getMedia),
    query: vi.fn(base.query),
    ...overrides,
  } as unknown as DataSource & {
    getMedia: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  return source;
}

const page = (children: string[]) => ({ type: 'test/page', slots: { default: children } });

describe('prepareRender: media', () => {
  it('batches every static MediaRef into a single getMedia call', async () => {
    const doc = makeDoc({
      root: page(['a', 'b', 'c']),
      a: { type: 'test/image', props: { image: ref('m1') } },
      b: { type: 'test/image', props: { image: ref('m2') } },
      c: { type: 'test/image', props: { image: ref('m1') } },
    });
    const source = spy();
    const prepared = await prepareRender(doc, registry, ctx, source);
    expect(source.getMedia).toHaveBeenCalledTimes(1);
    expect(source.getMedia.mock.calls[0]?.[0]).toEqual(['m1', 'm2']);
    expect(Object.keys(prepared.media)).toEqual(['m1', 'm2']);
    expect(prepared.collectionsUsed).toEqual(['media']);
    expect(prepared.diagnostics).toEqual([]);
  });

  it('does not call the source when there is nothing to fetch', async () => {
    const doc = makeDoc({
      root: page(['a']),
      a: { type: 'test/image', props: { image: bind('post.cover') } },
    });
    const source = spy();
    const prepared = await prepareRender(doc, registry, ctx, source);
    expect(source.getMedia).not.toHaveBeenCalled();
    expect(source.query).not.toHaveBeenCalled();
    expect(prepared).toEqual({ media: {}, queries: {}, collectionsUsed: [], diagnostics: [] });
  });

  it('reports a missing asset and an invalid asset, tagged with node and prop', async () => {
    const doc = makeDoc({
      root: page(['a', 'b']),
      a: { type: 'test/image', props: { image: ref('gone') } },
      b: { type: 'test/image', props: { image: ref('bad') } },
    });
    const source = spy({
      getMedia: vi.fn(async () => ({ bad: { id: 'bad' } })) as never,
    });
    const prepared = await prepareRender(doc, registry, ctx, source);
    expect(prepared.media).toEqual({});
    expect(prepared.diagnostics).toEqual([
      expect.objectContaining({
        code: 'media.missing',
        details: expect.objectContaining({ nodeId: 'a', prop: 'image', mediaId: 'gone' }),
      }),
      expect.objectContaining({
        code: 'media.invalid',
        details: expect.objectContaining({ nodeId: 'b' }),
      }),
    ]);
  });

  it('turns a getMedia failure into a diagnostic instead of throwing', async () => {
    const doc = makeDoc({
      root: page(['a']),
      a: { type: 'test/image', props: { image: ref('m1') } },
    });
    const source = spy({ getMedia: vi.fn(() => Promise.reject(new Error('boom'))) as never });
    const prepared = await prepareRender(doc, registry, ctx, source);
    expect(prepared.media).toEqual({});
    expect(prepared.diagnostics[0]).toMatchObject({ code: 'data.source-error', severity: 'error' });
    expect(prepared.diagnostics[0]?.message).toContain('boom');
  });

  it('ignores values that are not static MediaRefs and unknown components', async () => {
    const doc = makeDoc({
      root: page(['a', 'b', 'c']),
      a: { type: 'test/image', props: { image: s('not a ref') } },
      b: { type: 'test/image', props: { image: expr('site.name') } },
      c: { type: 'unknown/thing', props: { image: ref('m1') } },
    });
    const source = spy();
    await prepareRender(doc, registry, ctx, source);
    expect(source.getMedia).not.toHaveBeenCalled();
  });
});

describe('prepareRender: queries', () => {
  const loopDoc = (spec: Record<string, unknown>, extra: Record<string, PageNode> = {}) =>
    makeDoc({
      root: page(['loop']),
      loop: { type: 'test/loop', props: { source: query(spec) } },
      ...extra,
    } as never);

  it('runs a Loop query and stores the result under queryKey', async () => {
    const source = spy();
    const prepared = await prepareRender(
      loopDoc({ source: 'posts', limit: 10, sort: [{ field: 'title', dir: 'desc' }] }),
      registry,
      ctx,
      source,
    );
    const result = prepared.queries[queryKey('loop', 'source')];
    expect(result?.items.map((i) => (i as { title: string }).title)).toEqual(['C', 'B', 'A']);
    expect(prepared.collectionsUsed).toEqual(['posts']);
  });

  it('resolves bindings and expressions in filters and the page from the context', async () => {
    const source = spy();
    const prepared = await prepareRender(
      loopDoc({
        source: 'posts',
        limit: 1,
        where: { field: 'cat', op: 'eq', value: bind('route.params.cat') },
        page: expr('route.params.page - 1'),
      }),
      registry,
      ctx,
      source,
    );
    const sent = source.query.mock.calls[0]?.[0] as ResolvedQuerySpec;
    expect(sent).toMatchObject({ page: 1, limit: 1, where: { value: 'news' } });
    expect(prepared.queries[queryKey('loop', 'source')]).toMatchObject({ total: 2, totalPages: 2 });
  });

  it('excludes the current document when asked, and warns when it has no id', async () => {
    const doc = loopDoc({ source: 'posts', limit: 10, excludeCurrent: true });
    const withId = await prepareRender(doc, registry, ctx, spy(), { currentId: 2 });
    expect(withId.queries[queryKey('loop', 'source')]?.items).toHaveLength(2);
    const without = await prepareRender(doc, registry, ctx, spy());
    expect(without.queries[queryKey('loop', 'source')]?.items).toHaveLength(3);
    expect(without.diagnostics[0]?.code).toBe('query.no-current');
  });

  it('issues identical resolved queries once', async () => {
    const spec = { source: 'posts', limit: 5 };
    const doc = makeDoc({
      root: page(['l1', 'l2']),
      l1: { type: 'test/loop', props: { source: query(spec) } },
      l2: { type: 'test/loop', props: { source: query(spec) } },
    });
    const source = spy();
    const prepared = await prepareRender(doc, registry, ctx, source);
    expect(source.query).toHaveBeenCalledTimes(1);
    expect(Object.keys(prepared.queries).sort()).toEqual(['l1:source', 'l2:source']);
  });

  it('never has more than 4 queries in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const empty: QueryResult = { items: [], total: 0, page: 1, totalPages: 0 };
    const source = spy({
      query: (async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return empty;
      }) as never,
    });
    const nodes: Record<string, Partial<PageNode> & { type: string }> = {};
    const ids = Array.from({ length: 12 }, (_, i) => `l${i}`);
    nodes['root'] = page(ids);
    for (const [i, id] of ids.entries()) {
      nodes[id] = {
        type: 'test/loop',
        props: { source: query({ source: 'posts', limit: 1 + i }) },
      };
    }
    const prepared = await prepareRender(makeDoc(nodes), registry, ctx, source);
    expect(peak).toBe(MAX_QUERY_CONCURRENCY);
    expect(Object.keys(prepared.queries)).toHaveLength(12);

    peak = 0;
    await prepareRender(makeDoc(nodes), registry, ctx, source, { concurrency: 2 });
    expect(peak).toBe(2);
    peak = 0;
    await prepareRender(makeDoc(nodes), registry, ctx, source, { concurrency: 99 });
    expect(peak).toBe(MAX_QUERY_CONCURRENCY);
  });

  it('turns a source error and an invalid result into diagnostics, never a throw', async () => {
    const doc = loopDoc({ source: 'posts', limit: 3 });
    const failing = spy({ query: vi.fn(() => Promise.reject(new Error('db down'))) as never });
    const failed = await prepareRender(doc, registry, ctx, failing);
    expect(failed.queries).toEqual({});
    expect(failed.diagnostics[0]).toMatchObject({
      code: 'data.source-error',
      details: expect.objectContaining({ nodeId: 'loop', prop: 'source', source: 'posts' }),
    });
    const garbage = spy({ query: vi.fn(async () => ({ items: 'nope' })) as never });
    const invalid = await prepareRender(doc, registry, ctx, garbage);
    expect(invalid.diagnostics[0]?.code).toBe('query.invalid-result');
    const throwing = spy({
      query: vi.fn(() => {
        throw new Error('sync throw');
      }) as never,
    });
    expect((await prepareRender(doc, registry, ctx, throwing)).diagnostics[0]?.code).toBe(
      'data.source-error',
    );
  });

  it('rejects an unknown collection through the source', async () => {
    const prepared = await prepareRender(
      loopDoc({ source: 'secrets', limit: 3 }),
      registry,
      ctx,
      spy(),
    );
    expect(prepared.diagnostics[0]).toMatchObject({ code: 'data.source-error' });
  });

  it('reports an invalid spec and skips it', async () => {
    const source = spy();
    for (const spec of [{ source: 'posts' }, { source: 'posts', limit: 500 }, { limit: 1 }]) {
      const prepared = await prepareRender(loopDoc(spec), registry, ctx, source);
      expect(prepared.diagnostics[0]).toMatchObject({ code: 'query.invalid', severity: 'error' });
    }
    expect(source.query).not.toHaveBeenCalled();
  });

  it('fails the query rather than dropping an unresolved filter value', async () => {
    const source = spy();
    const prepared = await prepareRender(
      loopDoc({
        source: 'posts',
        limit: 3,
        where: { field: 'cat', op: 'eq', value: bind('route.params.missing') },
      }),
      registry,
      ctx,
      source,
    );
    expect(source.query).not.toHaveBeenCalled();
    expect(prepared.queries).toEqual({});
    expect(prepared.diagnostics.map((d) => d.code)).toContain('query.unresolved-value');
  });

  describe('a query that depends on the enclosing item', () => {
    const inner = (value: unknown, alias?: string) =>
      makeDoc({
        root: page(['outer']),
        outer: {
          type: 'test/loop',
          props: {
            source: bind('site.list'),
            ...(alias === undefined ? {} : { as: s(alias) }),
          },
          slots: { item: ['inner'] },
        },
        inner: {
          type: 'test/loop',
          props: {
            source: query({
              source: 'posts',
              limit: 3,
              where: { field: 'cat', op: 'eq', value },
            }),
          },
        },
      });

    it.each([
      ['a binding to item', bind('item.cat'), undefined],
      ['an expression reading item', expr('upper(item.cat)'), undefined],
      ['a template reading loop', expr('{{ loop.page }}', { mode: 'template' }), undefined],
      ['the as alias', bind('post.cat'), 'post'],
    ])('is an error and is not issued: %s', async (_name, value, alias) => {
      const source = spy();
      const prepared = await prepareRender(inner(value, alias), registry, ctx, source);
      expect(source.query).not.toHaveBeenCalled();
      expect(prepared.diagnostics).toEqual([
        expect.objectContaining({
          code: 'query.depends-on-item',
          severity: 'error',
          details: expect.objectContaining({ nodeId: 'inner', prop: 'source' }),
        }),
      ]);
    });

    it('allows a nested query that only reads outer data', async () => {
      const source = spy();
      const prepared = await prepareRender(inner(bind('route.params.cat')), registry, ctx, source);
      expect(source.query).toHaveBeenCalledTimes(1);
      expect(prepared.diagnostics).toEqual([]);
    });
  });
});

describe('prepareRender: result shape', () => {
  it('is fully serializable and deterministic', async () => {
    const doc = makeDoc({
      root: page(['a', 'loop', 'gone']),
      a: { type: 'test/image', props: { image: ref('m1') } },
      gone: { type: 'test/image', props: { image: ref('nope') } },
      loop: { type: 'test/loop', props: { source: query({ source: 'posts', limit: 2 }) } },
    });
    const first = await prepareRender(doc, registry, ctx, spy());
    const second = await prepareRender(doc, registry, ctx, spy());
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(second).toEqual(first);
  });

  it('survives cycles and dangling slot references', async () => {
    const doc = makeDoc({
      root: page(['a', 'missing']),
      a: { type: 'test/page', slots: { default: ['root', 'a'] } },
    });
    await expect(prepareRender(doc, registry, ctx, spy())).resolves.toMatchObject({ media: {} });
  });

  it('uses a compile cache for expressions', async () => {
    const cache = createCompileCache();
    const doc = makeDoc({
      root: page(['loop']),
      loop: {
        type: 'test/loop',
        props: {
          source: query({
            source: 'posts',
            limit: 3,
            where: { field: 'cat', op: 'eq', value: expr('lower("NEWS")') },
          }),
        },
      },
    });
    await prepareRender(doc, registry, ctx, spy(), { cache });
    expect(cache.size()).toBe(1);
  });
});

describe('resolveQuerySpec', () => {
  const base = { source: 'posts', limit: 5 };

  it('defaults the page and warns on an invalid one', () => {
    const ok = resolveQuerySpec(base, ctx);
    expect(ok.ok && ok.value.spec.page).toBe(1);
    const bad = resolveQuerySpec({ ...base, page: s(0) }, ctx);
    expect(bad.ok && bad.value.spec.page).toBe(1);
    expect(bad.ok && bad.value.diagnostics[0]?.code).toBe('query.invalid-page');
    const frac = resolveQuerySpec({ ...base, page: s(1.5) }, ctx);
    expect(frac.ok && frac.value.spec.page).toBe(1);
  });

  it('accepts an explicit null operand but not an unresolved one', () => {
    const nul = resolveQuerySpec(
      { ...base, where: { field: 'x', op: 'eq', value: s(null as JsonValue) } },
      ctx,
    );
    expect(nul.ok).toBe(true);
    const missing = resolveQuerySpec(
      { ...base, where: { field: 'x', op: 'eq', value: bind('nope') } },
      ctx,
    );
    expect(missing.ok).toBe(false);
  });

  it('reports a broken expression operand as a failure', () => {
    const result = resolveQuerySpec(
      { ...base, where: { and: [{ field: 'x', op: 'eq', value: expr('1 +') }] } },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.map((d) => d.code)).toContain('query.unresolved-value');
  });
});
