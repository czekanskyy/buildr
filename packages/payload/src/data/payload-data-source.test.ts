import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DataSource, ResolvedQuerySpec } from '@buildr/core';
import {
  DATA_SOURCE_FIXTURE,
  type DataSourceFixture,
  runDataSourceContract,
} from '@buildr/test-utils/contracts/data-source';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { buildConfig, getPayload, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPayloadDataSource, DataQueryError } from './payload-data-source.ts';

const open = { read: () => true };
const dir = mkdtempSync(join(tmpdir(), 'buildr-datasource-'));
let payload: Payload;

const queryable = {
  posts: {
    fields: ['title', 'views', 'tags', 'author.name', 'live'],
    sort: ['title', 'views', 'author.name'],
  },
  notes: { fields: ['title'], sort: ['title'] },
};

const source = (extra: Partial<Parameters<typeof createPayloadDataSource>[0]> = {}) =>
  createPayloadDataSource({ payload, queryable, mediaCollection: 'media', ...extra });

let seeded: Promise<void> | undefined;
async function seed(fixture: DataSourceFixture): Promise<void> {
  for (const item of fixture.collections['posts'] ?? []) {
    const { id: _id, ...data } = item as Record<string, unknown>;
    await payload.create({ collection: 'posts' as never, data: data as never });
  }
  for (const asset of Object.values(fixture.media)) {
    await payload.create({ collection: 'media' as never, data: asset as never });
  }
}

beforeAll(async () => {
  const config = buildConfig({
    secret: 'test-secret',
    collections: [
      {
        slug: 'posts',
        access: open,
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'views', type: 'number', required: true },
          { name: 'tags', type: 'text', hasMany: true },
          { name: 'author', type: 'group', fields: [{ name: 'name', type: 'text' }] },
          { name: 'live', type: 'checkbox', required: true },
        ],
      },
      {
        slug: 'media',
        access: open,
        fields: [
          { name: 'id', type: 'text' },
          { name: 'url', type: 'text' },
          { name: 'alt', type: 'text' },
          { name: 'width', type: 'number' },
          { name: 'height', type: 'number' },
          { name: 'mimeType', type: 'text' },
        ],
      },
      {
        slug: 'notes',
        access: open,
        fields: [{ name: 'title', type: 'text', required: true }],
        versions: { drafts: true },
      },
      { slug: 'guarded', fields: [{ name: 'title', type: 'text' }] },
    ],
    db: sqliteAdapter({ client: { url: `file:${join(dir, 'db.sqlite')}` } }),
    typescript: { autoGenerate: false },
  });
  payload = await getPayload({ config, key: 'datasource' });
  seeded = seed(DATA_SOURCE_FIXTURE);
  await seeded;
});
afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows keeps the database file open a moment longer.
  }
});

// The same contract MemoryDataSource is held to (posts and media are seeded once, above).
runDataSourceContract('PayloadDataSource', async () => {
  await seeded;
  return source();
});

const CTX = { locale: 'en', mode: 'production' } as const;
const spec = (query: Partial<ResolvedQuerySpec> = {}): ResolvedQuerySpec => ({
  source: 'posts',
  limit: 50,
  page: 1,
  ...query,
});
const run = (query: Partial<ResolvedQuerySpec>, data: DataSource = source()) =>
  data.query(spec(query), CTX);

describe('the allowlist', () => {
  it('rejects a field, a sort key or a collection that was not allowed', async () => {
    await expect(run({ where: { field: 'id', op: 'eq', value: '1' } })).rejects.toThrow(
      DataQueryError,
    );
    await expect(run({ where: { field: 'author', op: 'exists', value: true } })).rejects.toThrow(
      DataQueryError,
    );
    await expect(run({ sort: [{ field: 'live', dir: 'asc' }] })).rejects.toThrow(DataQueryError);
    await expect(run({ source: 'guarded' })).rejects.toThrow(DataQueryError);
    await expect(run({ source: 'users' })).rejects.toThrow(DataQueryError);
  });

  it('never queries a credential-like field even when it is allowed', async () => {
    const data = source({ queryable: { posts: { fields: ['password'], sort: [] } } });
    await expect(run({ where: { field: 'password', op: 'eq', value: 'x' } }, data)).rejects.toThrow(
      DataQueryError,
    );
  });

  it('rejects a limit or a page out of range', async () => {
    await expect(run({ limit: 0 })).rejects.toThrow(DataQueryError);
    await expect(run({ limit: 51 })).rejects.toThrow(DataQueryError);
    await expect(run({ page: 0 })).rejects.toThrow(DataQueryError);
  });
});

describe('item paths', () => {
  it('gives every item the address the application computes, and none without one', async () => {
    const withPath = source({
      itemPath: (collection, doc, locale) => `/${locale}/${collection}/${String(doc['title'])}`,
    });
    const items = (await run({ limit: 1 }, withPath)).items as { title: string; path?: string }[];
    expect(items[0]?.path).toBe(`/en/posts/${items[0]?.title}`);
    const plain = (await run({ limit: 1 })).items as { path?: string }[];
    expect(plain[0]).not.toHaveProperty('path');
  });
});

describe('access, drafts and the in-memory pass', () => {
  it('reads with the access of the request: a collection closed to visitors fails', async () => {
    await payload.create({ collection: 'guarded' as never, data: { title: 'x' } as never });
    const data = source({ queryable: { guarded: { fields: ['title'], sort: [] } } });
    await expect(run({ source: 'guarded' }, data)).rejects.toThrow();
  });

  it('serves published documents in production and drafts in preview and canvas', async () => {
    await payload.create({
      collection: 'notes' as never,
      data: { title: 'Live', _status: 'published' } as never,
    });
    await payload.create({
      collection: 'notes' as never,
      data: { title: 'Wip', _status: 'draft' } as never,
      draft: true,
    });
    const titles = async (mode: 'production' | 'preview' | 'canvas') => {
      const result = await source().query(spec({ source: 'notes' }), { locale: 'en', mode });
      return result.items.map((item) => (item as { title: string }).title).sort();
    };
    expect(await titles('production')).toEqual(['Live']);
    expect(await titles('preview')).toEqual(['Live', 'Wip']);
    expect(await titles('canvas')).toEqual(['Live', 'Wip']);
  });

  it('refuses to scan more than scanLimit documents', async () => {
    const data = source({ scanLimit: 3 });
    await expect(
      run({ where: { field: 'title', op: 'contains', value: 'a' } }, data),
    ).rejects.toThrow(DataQueryError);
    // Narrowed by the database first, the same query fits.
    const narrowed = await run(
      {
        where: {
          and: [
            { field: 'views', op: 'gte', value: 20 },
            { field: 'title', op: 'contains', value: 'a' },
          ],
        },
      },
      data,
    );
    expect(narrowed.items.length).toBeGreaterThan(0);
  });
});
