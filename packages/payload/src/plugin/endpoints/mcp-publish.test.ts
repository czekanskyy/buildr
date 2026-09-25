import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, type Harness, title, withChild } from './endpoints.test-kit.ts';

const KEY = 'agent-key-0123456789';
const PLAIN_KEY = `${KEY}-2`;
let h: Harness;
beforeAll(async () => {
  h = await boot(
    'mcp-publish',
    {
      mcp: { enabled: true, allowPublish: true },
      access: {
        publish: ({ req }) => String((req.user as { email?: string }).email).startsWith('pub'),
      },
    },
    { collections: [{ slug: 'users', auth: { useAPIKey: true }, fields: [] }] },
  );
  const users = [
    { email: 'pub-agent@example.com', apiKey: KEY },
    { email: 'plain-agent@example.com', apiKey: PLAIN_KEY },
  ];
  for (const user of users) {
    await h.payload.create({
      collection: 'users',
      data: { ...user, password: 'secret-password', enableAPIKey: true },
    });
  }
});
afterAll(() => h.close());

const as = (key: string, method: string, path: string, body?: unknown) =>
  h.call(method, path, {
    token: null,
    headers: { authorization: `users API-Key ${key}` },
    ...(body === undefined ? {} : { body }),
  });

describe('mcp.allowPublish', () => {
  it('lets an API-key user publish only when access.publish also allows it', async () => {
    const doc = await h.payload.create({ collection: 'pages', data: { title: 'P' }, draft: true });
    const path = `/buildr/documents/pages/${doc.id}`;
    const document = withChild(title('Hi'));
    const saved = await as(KEY, 'PUT', path, { document, baseRevision: 0, autosave: false });
    expect(saved.status).toBe(200);
    const denied = await as(PLAIN_KEY, 'POST', `${path}/publish`, { baseRevision: 1 });
    expect(denied.status).toBe(403);
    expect((await as(KEY, 'GET', '/buildr/session')).body.permissions.canPublish).toBe(true);
    expect((await as(KEY, 'POST', `${path}/publish`, { baseRevision: 1 })).status).toBe(200);
  });
});
