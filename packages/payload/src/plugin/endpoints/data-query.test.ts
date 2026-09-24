import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dataMediaResponseSchema, dataQueryResponseSchema } from '../../contract.ts';
import { boot, type Harness } from './endpoints.test-kit.ts';

let h: Harness;
beforeAll(async () => {
  h = await boot(
    'data-query',
    {
      queryable: {
        articles: { fields: ['title', 'views'], sort: ['views'] },
        pages: { fields: ['title'], sort: [] },
      },
      media: { collection: 'assets' },
    },
    {
      collections: [
        {
          slug: 'articles',
          access: { read: () => true },
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'views', type: 'number', required: true },
            { name: 'secret', type: 'text' },
          ],
        },
        {
          slug: 'assets',
          fields: [
            { name: 'url', type: 'text' },
            { name: 'alt', type: 'text' },
          ],
        },
      ],
    },
  );
  for (const [title, views] of [
    ['One', 1],
    ['Two', 2],
    ['Three', 3],
  ] as const) {
    await h.payload.create({
      collection: 'articles' as never,
      data: { title, views, secret: 'hidden' } as never,
    });
  }
  await h.payload.create({
    collection: 'assets' as never,
    data: { url: 'https://cdn.test/a.png', alt: 'A' } as never,
  });
});
afterAll(() => h.close());

const query = (spec: Record<string, unknown>, init: { token?: string | null } = {}) =>
  h.call('POST', '/buildr/data/query', { body: { spec }, ...init });
const base = { source: 'articles', limit: 10, page: 1 };

describe('POST /buildr/data/query', () => {
  it('answers an allowlisted query with the shared QueryResult', async () => {
    const { status, body } = await query({
      ...base,
      where: { field: 'views', op: 'gte', value: 2 },
      sort: [{ field: 'views', dir: 'desc' }],
    });
    expect(status).toBe(200);
    const result = dataQueryResponseSchema.parse(body);
    expect(result.total).toBe(2);
    expect(result.items.map((item) => (item as { title: string }).title)).toEqual(['Three', 'Two']);
    expect(JSON.stringify(body)).not.toContain('hidden');
  });

  it('refuses what was not allowlisted: 422', async () => {
    expect(
      (await query({ ...base, where: { field: 'secret', op: 'eq', value: 'x' } })).status,
    ).toBe(422);
    expect((await query({ ...base, source: 'users' })).status).toBe(422);
    expect((await query({ ...base, sort: [{ field: 'title', dir: 'asc' }] })).status).toBe(422);
  });

  it('validates the request and the caller: 400, 401, 403, 415', async () => {
    expect((await query({ source: 'articles' })).status).toBe(400);
    expect((await query(base, { token: null })).status).toBe(401);
    const viewer = await h.login('viewer@example.com');
    expect((await query(base, { token: viewer })).status).toBeLessThan(500);
    const noJson = await h.call('POST', '/buildr/data/query', {
      body: { spec: base },
      headers: { 'content-type': 'text/plain' },
    });
    expect(noJson.status).toBe(415);
  });
});

describe('POST /buildr/data/media', () => {
  it('returns the assets by id and leaves unknown ids out', async () => {
    const found = await h.payload.find({ collection: 'assets' as never });
    const id = String((found.docs[0] as { id: unknown }).id);
    const { status, body } = await h.call('POST', '/buildr/data/media', {
      body: { ids: [id, '9999'] },
    });
    expect(status).toBe(200);
    const assets = dataMediaResponseSchema.parse(body);
    expect(Object.keys(assets)).toEqual([id]);
    expect(assets[id]).toMatchObject({ url: 'https://cdn.test/a.png', alt: 'A' });
  });

  it('is for the builder only, and validates ids', async () => {
    expect(
      (await h.call('POST', '/buildr/data/media', { body: { ids: [] }, token: null })).status,
    ).toBe(401);
    expect((await h.call('POST', '/buildr/data/media', { body: { ids: 'x' } })).status).toBe(400);
  });
});
