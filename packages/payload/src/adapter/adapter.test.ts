import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEmptyDocument, type DataSource } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { createPayloadAdapter, createPayloadCanvasDataSource } from './index.ts';

interface Call {
  readonly method: string;
  readonly url: URL;
  readonly body: unknown;
  readonly headers: Record<string, string>;
}

/** A `fetch` that answers from `routes` (`"GET /path"`), recording what it was asked. */
function fakeFetch(routes: Record<string, () => { status: number; body?: unknown } | Error>) {
  const calls: Call[] = [];
  const fetch = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, 'http://site.test');
    const method = init.method ?? 'GET';
    calls.push({
      method,
      url,
      body:
        typeof init.body === 'string'
          ? JSON.parse(init.body)
          : init.body instanceof FormData
            ? init.body
            : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    const route = routes[`${method} ${url.pathname}`];
    if (route === undefined) throw new Error(`unexpected ${method} ${url.pathname}`);
    const answer = route();
    if (answer instanceof Error) throw answer;
    return new Response(answer.body === undefined ? '' : JSON.stringify(answer.body), {
      status: answer.status,
    });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

const REF = { collection: 'pages', id: 7 };
const doc = createEmptyDocument();
const documentBody = {
  ref: { collection: 'pages', id: 7 },
  title: 'Home',
  slug: 'home',
  status: 'draft',
  updatedAt: '2026-01-01T00:00:00.000Z',
  revision: 3,
  document: doc,
  contextRef: 'pages:7',
  previewPath: '/home',
  layoutSource: 'document',
  layoutRef: 'pages:1',
};

describe('createPayloadAdapter', () => {
  it('reads the session, with the languages of the site', async () => {
    const { fetch, calls } = fakeFetch({
      'GET /api/buildr/session': () => ({
        status: 200,
        body: {
          user: { id: 5 },
          permissions: { canEdit: true, canPublish: false, canUnlockTemplates: false },
          limits: { maxNodes: 10, maxBytes: 10 },
          locales: {
            locales: ['pl', 'en'],
            default: 'pl',
            fallback: true,
            intl: { pl: 'Polski', en: 'English' },
          },
        },
      }),
    });
    const adapter = createPayloadAdapter({ baseUrl: '/api/', fetch });
    expect(await adapter.getSession(REF)).toEqual({
      userId: '5',
      canEdit: true,
      canPublish: false,
      locales: {
        locales: ['pl', 'en'],
        default: 'pl',
        fallback: true,
        intl: { pl: 'Polski', en: 'English' },
      },
    });
    await adapter.getSession(REF);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.pathname).toBe('/api/buildr/session');
  });

  it('loads and validates a document; a broken one rejects', async () => {
    const good = fakeFetch({
      'GET /api/buildr/documents/pages/7': () => ({ status: 200, body: documentBody }),
    });
    const loaded = await createPayloadAdapter({ baseUrl: '/api', fetch: good.fetch }).load(REF);
    expect(loaded).toMatchObject({ title: 'Home', slug: 'home', status: 'draft', revision: 3 });
    expect(good.calls[0]?.url.searchParams.get('draft')).toBe('1');

    const bad = fakeFetch({
      'GET /api/buildr/documents/pages/7': () => ({
        status: 200,
        body: { ...documentBody, document: { nope: true } },
      }),
    });
    await expect(
      createPayloadAdapter({ baseUrl: '/api', fetch: bad.fetch }).load(REF),
    ).rejects.toThrow(/not valid/);
  });

  it('maps 409 and 422 of a save onto results, and everything else onto a rejection', async () => {
    let answer: { status: number; body?: unknown } = {
      status: 200,
      body: { revision: 4, updatedAt: 'now' },
    };
    const { fetch, calls } = fakeFetch({ 'PUT /api/buildr/documents/pages/7': () => answer });
    const adapter = createPayloadAdapter({ baseUrl: '/api', fetch });
    const request = { document: doc, baseRevision: 3, autosave: true };

    expect(await adapter.save(REF, request)).toEqual({ ok: true, revision: 4, updatedAt: 'now' });
    expect(calls[0]?.body).toEqual(request);
    expect(calls[0]?.headers['content-type']).toBe('application/json');

    answer = { status: 409, body: { currentRevision: 9 } };
    expect(await adapter.save(REF, request)).toEqual({
      ok: false,
      kind: 'conflict',
      currentRevision: 9,
    });

    const diagnostics = [{ code: 'x', message: 'bad', severity: 'error' }];
    answer = { status: 422, body: { diagnostics } };
    expect(await adapter.save(REF, request)).toEqual({ ok: false, kind: 'invalid', diagnostics });

    for (const status of [401, 403, 404, 500]) {
      answer = { status, body: { error: 'nope' } };
      await expect(adapter.save(REF, request)).rejects.toMatchObject({ status, message: 'nope' });
    }
    answer = { status: 200, body: { unexpected: true } };
    await expect(adapter.save(REF, request)).rejects.toThrow(/contract/);
  });

  it('rejects when there is no network', async () => {
    const { fetch } = fakeFetch({
      'PUT /api/buildr/documents/pages/7': () => new TypeError('offline'),
    });
    await expect(
      createPayloadAdapter({ baseUrl: '/api', fetch }).save(REF, {
        document: doc,
        baseRevision: 0,
        autosave: false,
      }),
    ).rejects.toMatchObject({ name: 'AdapterError', message: 'offline' });
  });

  it('reads only the revision, with who saved it', async () => {
    const { fetch, calls } = fakeFetch({
      'GET /api/buildr/documents/pages/7/revision': () => ({
        status: 200,
        body: { revision: 4, updatedAt: 'u', updatedBy: 'agent@example.com' },
      }),
    });
    expect(await createPayloadAdapter({ baseUrl: '/api', fetch }).getRevision?.(REF)).toEqual({
      revision: 4,
      updatedAt: 'u',
      updatedBy: 'agent@example.com',
    });
    expect(calls).toHaveLength(1);
  });

  it('publishes with the same result mapping', async () => {
    const { fetch } = fakeFetch({
      'POST /api/buildr/documents/pages/7/publish': () => ({
        status: 200,
        body: { status: 'published', publishedAt: 'p', revision: 5, updatedAt: 'u' },
      }),
    });
    expect(
      await createPayloadAdapter({ baseUrl: '/api', fetch }).publish(REF, { baseRevision: 4 }),
    ).toEqual({
      ok: true,
      revision: 5,
      updatedAt: 'u',
    });
  });

  it('builds the data context from the sample, the language and the session', async () => {
    const { fetch, calls } = fakeFetch({
      'GET /api/buildr/session': () => ({
        status: 200,
        body: {
          user: { id: 1 },
          permissions: { canEdit: true, canPublish: true, canUnlockTemplates: true },
          limits: { maxNodes: 1, maxBytes: 1 },
          locales: {
            locales: ['pl', 'en'],
            default: 'pl',
            fallback: false,
            intl: { pl: 'Polski', en: 'English' },
          },
        },
      }),
      'GET /api/buildr/data/context': () => ({
        status: 200,
        body: { scopes: { page: { title: 'T' } } },
      }),
    });
    const adapter = createPayloadAdapter({ baseUrl: '/api', fetch, timeZone: 'Europe/Warsaw' });
    const context = await adapter.getContext(REF, { sampleId: '12' });
    expect(context).toMatchObject({
      scopes: { page: { title: 'T' } },
      locale: 'pl',
      timeZone: 'Europe/Warsaw',
      mode: 'canvas',
      locales: { default: 'pl', fallback: false },
    });
    const query = calls.at(-1)?.url.searchParams;
    expect(query?.get('id')).toBe('12');
    expect(query?.get('collection')).toBe('pages');

    await adapter.getContext(REF, { sampleId: 'posts:5' });
    const qualified = calls.at(-1)?.url.searchParams;
    expect(qualified?.get('collection')).toBe('posts');
    expect(qualified?.get('id')).toBe('5');
    expect(query?.get('locale')).toBe('pl');
  });

  it('searches media with a cursor and a type, and uploads with the alt', async () => {
    const asset = { id: 'm1', url: '/m1.png', mimeType: 'image/png', alt: 'One' };
    const { fetch, calls } = fakeFetch({
      'GET /api/buildr/media': () => ({
        status: 200,
        body: { items: [asset], page: 2, totalPages: 3 },
      }),
      'POST /api/buildr/media': () => ({ status: 201, body: asset }),
    });
    const adapter = createPayloadAdapter({ baseUrl: '/api', fetch });
    const found = await adapter.media.search({
      text: 'cat',
      cursor: '2',
      mimeTypes: ['image/png', 'image/jpeg'],
    });
    expect(found).toEqual({ items: [asset], nextCursor: '3' });
    const query = calls[0]?.url.searchParams;
    expect([query?.get('search'), query?.get('type'), query?.get('page')]).toEqual([
      'cat',
      'image',
      '2',
    ]);

    const uploaded = await adapter.media.upload?.(
      new File(['x'], 'a.png', { type: 'image/png' }),
      'One',
    );
    expect(uploaded).toEqual(asset);
    const form = calls[1]?.body as FormData;
    expect(form.get('alt')).toBe('One');
    expect((form.get('file') as File).name).toBe('a.png');
    expect(calls[1]?.headers['content-type']).toBeUndefined();
  });

  it('lists samples, and links to the preview and the admin', async () => {
    const { fetch } = fakeFetch({
      'GET /api/buildr/samples/pages': () => ({
        status: 200,
        body: { items: [{ id: '1', title: 'A' }] },
      }),
    });
    const adapter = createPayloadAdapter({ baseUrl: '/api', fetch });
    expect(await adapter.listSamples?.(REF)).toEqual([{ id: 'pages:1', label: 'A' }]);
    expect(adapter.previewUrl(REF, { draft: true })).toBe(
      '/buildr/preview?collection=pages&id=7&draft=1',
    );
    expect(adapter.previewUrl(REF)).toBe('/buildr/preview?collection=pages&id=7');
    expect(adapter.cmsUrl?.(REF)).toBe('/admin/collections/pages/7');
  });
});

describe('createPayloadCanvasDataSource', () => {
  const spec = { source: 'posts', limit: 5, page: 1 } as const;
  const ctx = { locale: 'en', mode: 'canvas' } as const;

  it('runs queries and media through the builder API', async () => {
    const result = { items: [{ id: '1' }], total: 1, page: 1, totalPages: 1 };
    const { fetch, calls } = fakeFetch({
      'POST /api/buildr/data/query': () => ({ status: 200, body: result }),
      'POST /api/buildr/data/media': () => ({
        status: 200,
        body: { m1: { id: 'm1', url: '/m1.png', mimeType: 'image/png' } },
      }),
    });
    const source: DataSource = createPayloadCanvasDataSource({ baseUrl: '/api', fetch });
    expect(await source.query(spec, ctx)).toEqual(result);
    expect(calls[0]?.body).toEqual({ spec, locale: 'en' });
    expect(Object.keys(await source.getMedia(['m1', 'm1'], ctx))).toEqual(['m1']);
    expect(calls[1]?.body).toEqual({ ids: ['m1'], locale: 'en' });
    expect(await source.getMedia([], ctx)).toEqual({});
    expect(calls).toHaveLength(2);
  });

  it('rejects with the reason the server gave', async () => {
    const { fetch } = fakeFetch({
      'POST /api/buildr/data/query': () => ({
        status: 422,
        body: { error: 'The collection "x" cannot be queried.' },
      }),
    });
    await expect(
      createPayloadCanvasDataSource({ baseUrl: '/api', fetch }).query(spec, ctx),
    ).rejects.toThrow(/cannot be queried/);
  });
});

describe('the adapter boundary', () => {
  it('never imports payload, @payloadcms or next', () => {
    const dir = import.meta.dirname;
    const forbidden =
      /from\s+['"](payload|@payloadcms\/[^'"]*|next|next\/[^'"]*|@next-buildr\/next)['"]/;
    for (const file of readdirSync(dir).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    )) {
      expect(readFileSync(join(dir, file), 'utf8'), file).not.toMatch(forbidden);
    }
  });
});
