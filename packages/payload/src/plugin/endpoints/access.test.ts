import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, type Harness, title, withChild } from './endpoints.test-kit.ts';

const emailOf = (req: { user?: unknown }) => String((req.user as { email?: string }).email);

let h: Harness;
let tokens: Record<'viewer' | 'author' | 'publisher', string>;
let path: string;
beforeAll(async () => {
  h = await boot('access', {
    access: {
      edit: ({ req }) => !emailOf(req).startsWith('viewer'),
      publish: ({ req }) => emailOf(req).startsWith('publisher'),
      unlockTemplates: ({ req }) => emailOf(req).startsWith('publisher'),
    },
  });
  tokens = {
    viewer: await h.login('viewer@example.com'),
    author: await h.login('author@example.com'),
    publisher: await h.login('publisher@example.com'),
  };
  const doc = await h.payload.create({
    collection: 'pages',
    data: { title: 'Home', slug: 'home' },
    draft: true,
  });
  path = `/buildr/documents/pages/${doc.id}`;
});
afterAll(() => h.close());

const layout = withChild(title('Hi'));
const save = (token: string | null, revision: number) =>
  h.call('PUT', path, {
    token,
    body: { document: layout, baseRevision: revision, autosave: false },
  });
const publish = (token: string | null, revision: number) =>
  h.call('POST', `${path}/publish`, { token, body: { baseRevision: revision } });

describe('role x endpoint matrix', () => {
  it('answers 401 without a user, whatever the endpoint', async () => {
    const statuses = [
      (await h.call('GET', path, { token: null })).status,
      (await save(null, 0)).status,
      (await publish(null, 0)).status,
    ];
    expect(statuses).toEqual([401, 401, 401]);
  });

  it('keeps a viewer out of the builder altogether', async () => {
    expect((await h.call('GET', path, { token: tokens.viewer })).status).toBe(403);
    expect((await save(tokens.viewer, 0)).status).toBe(403);
    expect((await publish(tokens.viewer, 0)).status).toBe(403);
  });

  it('lets an author save but not publish, and a publisher do both', async () => {
    expect((await save(tokens.author, 0)).status).toBe(200);
    expect((await publish(tokens.author, 1)).status).toBe(403);
    expect((await publish(tokens.publisher, 1)).status).toBe(200);
  });

  it('reports each role its permissions in the session', async () => {
    const permissions = async (token: string) =>
      (await h.call('GET', '/buildr/session', { token })).body.permissions;
    expect(await permissions(tokens.viewer)).toEqual({
      canEdit: false,
      canPublish: false,
      canUnlockTemplates: false,
    });
    expect(await permissions(tokens.author)).toEqual({
      canEdit: true,
      canPublish: false,
      canUnlockTemplates: false,
    });
    expect(await permissions(tokens.publisher)).toEqual({
      canEdit: true,
      canPublish: true,
      canUnlockTemplates: true,
    });
  });
});

describe('CSRF guards on mutating requests', () => {
  const send = (headers: Record<string, string>, method = 'PUT') =>
    h.call(method, method === 'PUT' ? path : `${path}/publish`, {
      token: tokens.publisher,
      body:
        method === 'PUT'
          ? { document: layout, baseRevision: 99, autosave: false }
          : { baseRevision: 99 },
      headers,
    });

  it('refuses a foreign Origin, but accepts the own one and none', async () => {
    expect((await send({ origin: 'https://evil.example' })).status).toBe(403);
    expect((await send({ origin: 'https://evil.example' }, 'POST')).status).toBe(403);
    expect((await send({ origin: 'null' })).status).toBe(403);
    expect((await send({ origin: 'http://localhost' })).status).toBe(409);
    expect((await send({})).status).toBe(409);
  });

  it('refuses a body that is not declared as JSON', async () => {
    expect((await send({ 'content-type': 'text/plain' })).status).toBe(415);
    expect((await send({ 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(415);
  });
});
