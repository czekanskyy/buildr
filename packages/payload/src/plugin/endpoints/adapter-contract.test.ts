import { handleEndpoints } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPayloadAdapter } from '../../adapter/index.ts';
import { boot, type Harness } from './endpoints.test-kit.ts';

let h: Harness;
let pageId: string;
beforeAll(async () => {
  h = await boot('adapter-server');
  const page = await h.payload.create({
    collection: 'pages',
    data: { title: 'Home', slug: 'home' } as never,
    draft: true,
  });
  pageId = String(page.id);
});
afterAll(() => h.close());

/** The adapter's `fetch`, answered by the real endpoints (no network). */
const serverFetch = ((input: string, init: RequestInit = {}) =>
  handleEndpoints({
    config: h.payload.config,
    request: new Request(new URL(input, 'http://localhost'), {
      ...init,
      headers: { ...(init.headers as Record<string, string>), authorization: `JWT ${h.token}` },
    }),
  })) as unknown as typeof globalThis.fetch;

describe('the adapter against the real endpoints', () => {
  const adapter = () => createPayloadAdapter({ baseUrl: '/api', fetch: serverFetch });

  it('reads the session and the data schema', async () => {
    const ref = { collection: 'pages', id: pageId };
    expect(await adapter().getSession(ref)).toMatchObject({ canEdit: true, canPublish: true });
    const schema = await adapter().getDataSchema(ref);
    expect(Object.keys(schema.scopes)).toContain('page');
  });

  it('lists samples and builds a context', async () => {
    const ref = { collection: 'pages', id: pageId };
    expect(await adapter().listSamples?.(ref)).toEqual([{ id: `pages:${pageId}`, label: 'Home' }]);
    const context = await adapter().getContext(ref);
    expect(context.scopes['page']).toMatchObject({ title: 'Home' });
    expect(context.mode).toBe('canvas');
  });

  it('rejects when the server refuses (a collection that is not configured)', async () => {
    await expect(adapter().getDataSchema({ collection: 'users', id: '1' })).rejects.toMatchObject({
      status: 404,
    });
  });
});
