import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, type Harness } from './endpoints.test-kit.ts';

const KEY = 'agent-key-0123456789';
let h: Harness;
beforeAll(async () => {
  h = await boot(
    'mcp-off',
    {},
    { collections: [{ slug: 'users', auth: { useAPIKey: true }, fields: [] }] },
  );
  await h.payload.create({
    collection: 'users',
    data: {
      email: 'agent@example.com',
      password: 'secret-password',
      enableAPIKey: true,
      apiKey: KEY,
    },
  });
});
afterAll(() => h.close());

const asAgent = (method: string, path: string) =>
  h.call(method, path, { token: null, headers: { authorization: `users API-Key ${KEY}` } });

describe('mcp disabled (the default)', () => {
  it('refuses API-key requests to the builder, but not a session', async () => {
    const doc = await h.payload.create({ collection: 'pages', data: { title: 'A' }, draft: true });
    expect((await asAgent('GET', `/buildr/documents/pages/${doc.id}`)).status).toBe(403);
    expect((await asAgent('GET', '/buildr/session')).body.permissions.canEdit).toBe(false);
    expect((await h.call('GET', `/buildr/documents/pages/${doc.id}`)).status).toBe(200);
  });

  it('does not register the list and create endpoints', async () => {
    expect((await h.call('GET', '/buildr/documents?collection=pages')).status).toBe(404);
    const create = await h.call('POST', '/buildr/documents', {
      body: { collection: 'pages', title: 'x' },
    });
    expect(create.status).toBe(404);
  });
});
