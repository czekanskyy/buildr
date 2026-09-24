import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { boot, type Harness, title, withChild } from '../plugin/endpoints/endpoints.test-kit.ts';
import { type CacheRead, getBuildrDocument, listPublishedSlugs } from './index.ts';

let h: Harness;
beforeAll(async () => {
  h = await boot(
    'get-document',
    {
      collections: {
        pages: { context: 'page', templates: true, path: (d) => `/${String(d['slug'])}` },
      },
    },
    {
      pageAccess: { read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }) },
      globals: [
        {
          slug: 'site-settings',
          access: { read: () => true },
          fields: [{ name: 'siteName', type: 'text' }],
        },
      ],
    },
  );
  await h.payload.updateGlobal({
    slug: 'site-settings' as never,
    data: { siteName: 'Acme' } as never,
  });
});
afterAll(() => h.close());

const create = (data: Record<string, unknown>, status: 'draft' | 'published') =>
  h.payload.create({
    collection: 'pages',
    data: { ...data, _status: status } as never,
    draft: status === 'draft',
  });

/** A cache that only records what it was asked to cache, and runs the read. */
const spyCache = () => {
  const calls: { keys: string[]; tags: string[] }[] = [];
  const cache: CacheRead = (read, keys, options) => {
    calls.push({ keys, tags: options.tags });
    return read;
  };
  return { cache, calls };
};

describe('getBuildrDocument', () => {
  it('reads a published page by slug: layout, context and tags', async () => {
    const page = await create(
      { title: 'About', slug: 'about', layout: withChild(title('Hi')) },
      'published',
    );
    const { cache, calls } = spyCache();
    const entry = await getBuildrDocument({
      payload: h.payload,
      collection: 'pages',
      slug: 'about',
      contextName: 'page',
      path: (doc) => `/${String(doc['slug'])}`,
      cache,
    });
    expect(entry).not.toBeNull();
    expect(entry?.layoutSource).toBe('document');
    expect(entry?.layoutRef).toBe(`pages:${page.id}`);
    expect(entry?.currentId).toBe(page.id);
    expect(entry?.context).toMatchObject({
      mode: 'production',
      scopes: { page: { title: 'About' }, site: { siteName: 'Acme' }, route: { path: '/about' } },
    });
    expect(entry?.tags).toEqual(
      [
        'buildr:col:pages',
        `buildr:doc:pages:${page.id}`,
        'buildr:global:site-settings',
        'buildr:theme',
      ].sort(),
    );
    // Published reads go through the cache, keyed by document and language.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.keys).toContain('slug:about');
  });

  it('reads by id and falls back to the built-in layout', async () => {
    const page = await create({ title: 'Bare', slug: 'bare' }, 'published');
    const entry = await getBuildrDocument({
      payload: h.payload,
      collection: 'pages',
      id: page.id,
      contextName: 'page',
      cache: spyCache().cache,
    });
    expect(entry?.layoutSource).toBe('builtin');
    expect(entry?.layoutRef).toBeNull();
  });

  it('does not show a draft to a visitor, and does not cache a draft read', async () => {
    await create({ title: 'Secret', slug: 'secret' }, 'draft');
    const { cache, calls } = spyCache();
    const visitor = await getBuildrDocument({
      payload: h.payload,
      collection: 'pages',
      slug: 'secret',
      cache,
    });
    expect(visitor).toBeNull();

    const user = { id: 1, collection: 'users' };
    const asEditor = spyCache();
    const draftRead = await getBuildrDocument({
      payload: h.payload,
      collection: 'pages',
      slug: 'secret',
      draft: true,
      user,
      cache: asEditor.cache,
    });
    // The test config has no auth collection, so the local API treats the user as a visitor here; what
    // matters is that a draft read never touches the cache.
    expect(asEditor.calls).toHaveLength(0);
    expect(draftRead === null || draftRead.context.mode === 'preview').toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('answers null for a missing document and needs exactly one of slug and id', async () => {
    expect(
      await getBuildrDocument({
        payload: h.payload,
        collection: 'pages',
        slug: 'nope',
        cache: spyCache().cache,
      }),
    ).toBeNull();
    await expect(getBuildrDocument({ payload: h.payload, collection: 'pages' })).rejects.toThrow(
      /exactly one/,
    );
    await expect(
      getBuildrDocument({ payload: h.payload, collection: 'pages', slug: 'a', id: 1 }),
    ).rejects.toThrow(/exactly one/);
  });

  it('runs the read once per cache miss (the wrapper decides)', async () => {
    const read = vi.fn();
    const cache: CacheRead = (fn, _keys, _options) => {
      let memo: Promise<unknown> | undefined;
      read();
      return () => {
        memo ??= fn();
        return memo as never;
      };
    };
    const args = { payload: h.payload, collection: 'pages', slug: 'about', cache };
    await getBuildrDocument(args);
    await getBuildrDocument(args);
    expect(read).toHaveBeenCalledTimes(2); // one wrapper per call; memoization is the cache's business
  });
});

describe('listPublishedSlugs', () => {
  it('lists published slugs only', async () => {
    const slugs = await listPublishedSlugs({ payload: h.payload, collection: 'pages' });
    expect(slugs).toContain('about');
    expect(slugs).toContain('bare');
    expect(slugs).not.toContain('secret');
  });
});
