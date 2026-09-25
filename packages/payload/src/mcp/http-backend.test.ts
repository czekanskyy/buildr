import { createEmptyDocument } from '@buildr/core';
import { describe, expect, it, vi } from 'vitest';
import { createPayloadMcpBackend, type PayloadMcpBackendOptions } from './http-backend.ts';

const KEY = 'super-secret-api-key-123';
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
const summary = (id: number) => ({
  ref: { collection: 'pages', id: String(id) },
  title: `Page ${id}`,
  slug: `page-${id}`,
  status: 'draft',
  updatedAt: '2026-01-01T00:00:00.000Z',
  revision: 0,
  layoutSource: 'builtin',
  previewPath: null,
});
const ref = { collection: 'pages', id: '1' };

function setup(
  handler: (request: Request) => Response | Promise<Response>,
  o: Partial<PayloadMcpBackendOptions> = {},
) {
  const requests: Request[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    return handler(request);
  });
  const backend = createPayloadMcpBackend({
    baseUrl: 'https://site.test/api/',
    apiKey: KEY,
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: async () => {},
    ...o,
  });
  return { backend, requests, fetch };
}

describe('createPayloadMcpBackend', () => {
  it('sends the key as an API-Key header and never in the URL', async () => {
    const { backend, requests } = setup(() =>
      json(200, {
        user: { id: 1 },
        permissions: { canEdit: true, canPublish: false, canUnlockTemplates: false },
        limits: { maxNodes: 10, maxBytes: 10 },
      }),
    );
    expect((await backend.getSession()).ok).toBe(true);
    expect(requests[0]?.headers.get('authorization')).toBe(`users API-Key ${KEY}`);
    expect(requests[0]?.url).toBe('https://site.test/api/buildr/session');
    expect(requests[0]?.url).not.toContain(KEY);
  });

  it('uses the configured auth collection', async () => {
    const { backend, requests } = setup(() => json(404, {}), { collection: 'agents' });
    await backend.getDataSchema('pages');
    expect(requests[0]?.headers.get('authorization')).toBe(`agents API-Key ${KEY}`);
  });

  it('never leaks the key: not from thrown fetch errors, server messages or diagnostics', async () => {
    const results = [];
    for (const handler of [
      () => {
        throw new Error(`connect failed with Authorization: users API-Key ${KEY}`);
      },
      () => json(500, { error: `boom ${KEY}` }),
      () => json(403, { error: `denied for ${KEY}` }),
      () => json(400, { error: `bad ${KEY}` }),
      () => json(404, { error: `missing ${KEY}` }),
      () => json(422, { diagnostics: [{ code: 'x', message: `no ${KEY}`, severity: 'error' }] }),
      () => json(401, { error: KEY }),
      () => new Response(`<html>${KEY}</html>`, { status: 200 }),
    ]) {
      const { backend } = setup(handler, { retries: 0 });
      results.push(await backend.load(ref), await backend.save(ref, createEmptyDocument(), 0));
    }
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(JSON.stringify(results)).not.toContain(KEY);
  });

  it('retries GETs with backoff on network errors and 503, then succeeds', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    let calls = 0;
    const { backend } = setup(
      () => {
        calls += 1;
        if (calls === 1) throw new Error('reset');
        if (calls === 2) return json(503, {});
        return json(200, { items: [], page: 1, totalPages: 0 });
      },
      { sleep, retries: 2 },
    );
    expect((await backend.listDocuments({ collection: 'pages' })).ok).toBe(true);
    expect(calls).toBe(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([200, 400]);
  });

  it('reports a retryable network error once retries are exhausted', async () => {
    const { backend, fetch } = setup(() => json(503, {}), { retries: 1 });
    const result = await backend.load(ref);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(!result.ok && result.error).toMatchObject({ code: 'network', retryable: true });
  });

  it('never retries writes', async () => {
    const { backend, fetch } = setup(() => json(503, {}), { retries: 3 });
    await backend.save(ref, createEmptyDocument(), 0);
    await backend.publish(ref, 0);
    await backend.createDocument({ collection: 'pages', title: 'x' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('maps 409 to conflict with the current revision and 429 to a retryable network error', async () => {
    const conflict = setup(() => json(409, { currentRevision: 7 })).backend;
    const saved = await conflict.save(ref, createEmptyDocument(), 3);
    expect(!saved.ok && saved.error).toMatchObject({ code: 'conflict', currentRevision: 7 });
    const limited = setup(() => json(429, { error: 'slow down' }, { 'retry-after': '7' })).backend;
    const created = await limited.createDocument({ collection: 'pages', title: 'x' });
    expect(!created.ok && created.error).toMatchObject({ code: 'network', retryable: true });
  });

  it('maps 422 to invalid with the server diagnostics', async () => {
    const { backend } = setup(() =>
      json(422, {
        diagnostics: [
          { code: 'doc.bad', message: 'Bad node.', severity: 'error', path: ['nodes', 'a'] },
        ],
      }),
    );
    const result = await backend.save(ref, createEmptyDocument(), 0);
    expect(!result.ok && result.error).toMatchObject({
      code: 'invalid',
      diagnostics: [{ code: 'doc.bad', path: ['nodes', 'a'] }],
    });
  });

  it('rejects an answer that breaks the contract without retrying', async () => {
    const { backend, fetch } = setup(() => json(200, { unexpected: true }));
    const result = await backend.getSession();
    expect(!result.ok && result.error).toMatchObject({ code: 'network', retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('validates input before sending anything', async () => {
    const { backend, fetch } = setup(() => json(200, {}));
    expect((await backend.listDocuments({ limit: 0 })).ok).toBe(false);
    expect((await backend.createDocument({ collection: 'pages', title: '' })).ok).toBe(false);
    expect((await backend.save(ref, { nonsense: true } as never, 0)).ok).toBe(false);
    expect((await backend.listDocuments()).ok).toBe(false); // no collection, none configured
    expect(fetch).not.toHaveBeenCalled();
  });

  it('windows a listing over the 20-per-page server pages and reports the exact total', async () => {
    const { backend, requests } = setup((request) => {
      const page = Number(new URL(request.url).searchParams.get('page'));
      const count = page === 3 ? 5 : 20;
      const items = Array.from({ length: count }, (_, i) => summary((page - 1) * 20 + i + 1));
      return json(200, { items, page, totalPages: 3 });
    });
    const result = await backend.listDocuments({ collection: 'pages', page: 2, limit: 30 });
    expect(result.ok && result.value.total).toBe(45);
    expect(result.ok && result.value.totalPages).toBe(2);
    expect(result.ok && result.value.items.map((i) => i.ref.id)).toEqual(
      Array.from({ length: 15 }, (_, i) => String(31 + i)),
    );
    expect(requests.map((r) => new URL(r.url).searchParams.get('page'))).toEqual(['2', '3']);
  });

  it('lists the configured collections when none is given, filtered by status', async () => {
    const { backend } = setup(
      (request) => {
        const collection = new URL(request.url).searchParams.get('collection');
        const draft = { ...summary(collection === 'pages' ? 1 : 2), ref: { collection, id: '1' } };
        const live = { ...summary(3), status: 'published', ref: { collection, id: '3' } };
        return json(200, { items: [draft, live], page: 1, totalPages: 1 });
      },
      { collections: ['pages', 'posts'] },
    );
    const all = await backend.listDocuments();
    expect(all.ok && all.value.total).toBe(4);
    const drafts = await backend.listDocuments({ status: 'draft' });
    expect(drafts.ok && drafts.value.items.every((i) => i.status === 'draft')).toBe(true);
    expect(drafts.ok && drafts.value.total).toBe(2);
  });

  it('builds the preview URL from the site origin', async () => {
    const { backend } = setup(() =>
      json(200, {
        ref,
        title: 'Home',
        slug: 'home',
        status: 'draft',
        updatedAt: 'x',
        revision: 0,
        document: createEmptyDocument(),
        contextRef: 'pages:1',
        layoutSource: 'document',
        layoutRef: 'pages:1',
        previewPath: '/home',
      }),
    );
    const url = await backend.previewUrl(ref);
    expect(url.ok && url.value).toBe('https://site.test/home');
  });
});
