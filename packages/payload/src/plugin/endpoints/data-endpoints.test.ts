import { dataSchemaSchema } from '@buildr/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dataContextResponseSchema, samplesResponseSchema } from '../../contract.ts';
import { boot, type Harness } from './endpoints.test-kit.ts';

let h: Harness;
let authorId: number;
let pageId: number;
beforeAll(async () => {
  h = await boot(
    'data-endpoints',
    {
      collections: {
        pages: { context: 'page', depth: 1, path: (doc) => `/${String(doc['slug'])}` },
      },
    },
    {
      pageFields: [
        { name: 'author', type: 'relationship', relationTo: 'authors' },
        { name: 'owner', type: 'relationship', relationTo: 'users' },
        { name: 'internalNote', type: 'text', hidden: true },
        { name: 'publishedOn', type: 'date' },
      ],
      collections: [
        {
          slug: 'authors',
          fields: [
            { name: 'name', type: 'text' },
            { name: 'apiKey', type: 'text' },
          ],
        },
      ],
      globals: [
        {
          slug: 'site-settings',
          fields: [
            { name: 'siteName', type: 'text' },
            { name: 'token', type: 'text' },
          ],
        },
      ],
    },
  );
  const author = await h.payload.create({
    collection: 'authors' as never,
    data: { name: 'Ada', apiKey: 'secret-key' } as never,
  });
  authorId = Number(author.id);
  await h.payload.updateGlobal({
    slug: 'site-settings' as never,
    data: { siteName: 'Buildr', token: 'global-secret' } as never,
  });
  const users = await h.payload.find({ collection: 'users' });
  const page = await h.payload.create({
    collection: 'pages',
    data: {
      title: 'Home',
      slug: 'home',
      author: authorId,
      owner: users.docs[0]?.id,
      internalNote: 'private',
      publishedOn: '2026-03-04T00:00:00.000Z',
    } as never,
    draft: true,
  });
  pageId = Number(page.id);
});
afterAll(() => h.close());

describe('GET /buildr/data-schema/:collection', () => {
  it('describes the collection and never the users', async () => {
    const { status, body } = await h.call('GET', '/buildr/data-schema/pages');
    expect(status).toBe(200);
    const schema = dataSchemaSchema.parse(body);
    expect(Object.keys(schema.scopes).sort()).toEqual(['page', 'route', 'site']);
    expect(Object.keys(schema.entities)).toEqual(['authors']);
    const json = JSON.stringify(body);
    for (const leaked of ['users', 'email', 'apiKey', 'token', 'internalNote', 'owner', 'layout']) {
      expect(json).not.toContain(`"${leaked}"`);
    }
    expect(json).toContain('"publishedOn"');
  });

  it('is for the builder only: 401, 404', async () => {
    expect((await h.call('GET', '/buildr/data-schema/pages', { token: null })).status).toBe(401);
    expect((await h.call('GET', '/buildr/data-schema/authors')).status).toBe(404);
  });
});

describe('GET /buildr/data/context', () => {
  it('builds the scopes of a document, its author included', async () => {
    const { status, body } = await h.call(
      'GET',
      `/buildr/data/context?collection=pages&id=${pageId}&locale=pl`,
    );
    expect(status).toBe(200);
    const { scopes } = dataContextResponseSchema.parse(body);
    expect(scopes['page']).toMatchObject({
      id: String(pageId),
      title: 'Home',
      slug: 'home',
      publishedOn: '2026-03-04T00:00:00.000Z',
      author: { id: String(authorId), name: 'Ada' },
    });
    expect(scopes['site']).toMatchObject({ siteName: 'Buildr' });
    expect(scopes['route']).toEqual({ path: '/home', locale: 'pl', params: { page: null } });
    const json = JSON.stringify(scopes);
    for (const leaked of ['secret-key', 'global-secret', 'private', 'editor@example.com']) {
      expect(json).not.toContain(leaked);
    }
  });

  it('answers 400, 401 and 404 to a bad, anonymous or unknown request', async () => {
    expect((await h.call('GET', '/buildr/data/context?collection=pages')).status).toBe(400);
    expect(
      (await h.call('GET', `/buildr/data/context?collection=pages&id=${pageId}`, { token: null }))
        .status,
    ).toBe(401);
    expect((await h.call('GET', '/buildr/data/context?collection=pages&id=99999')).status).toBe(
      404,
    );
    expect((await h.call('GET', `/buildr/data/context?collection=users&id=${pageId}`)).status).toBe(
      404,
    );
  });
});

describe('GET /buildr/samples/:collection', () => {
  it('lists documents by their title and filters by search', async () => {
    await h.payload.create({
      collection: 'pages',
      data: { title: 'About us', slug: 'about' },
      draft: true,
    });
    const all = samplesResponseSchema.parse((await h.call('GET', '/buildr/samples/pages')).body);
    expect(all.items.map((item) => item.title).sort()).toEqual(['About us', 'Home']);
    const found = samplesResponseSchema.parse(
      (await h.call('GET', '/buildr/samples/pages?search=about')).body,
    );
    expect(found.items.map((item) => item.title)).toEqual(['About us']);
  });

  it('answers 401 and 404', async () => {
    expect((await h.call('GET', '/buildr/samples/pages', { token: null })).status).toBe(401);
    expect((await h.call('GET', '/buildr/samples/users')).status).toBe(404);
  });
});
