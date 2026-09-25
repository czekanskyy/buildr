import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { documentSummarySchema } from '../../contract.ts';
import { boot, type Harness, title, withChild } from './endpoints.test-kit.ts';

const KEY = 'agent-key-0123456789';
let blocked = false;
let h: Harness;
let agent: (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;

beforeAll(async () => {
  h = await boot(
    'mcp',
    {
      collections: {
        pages: { context: 'page', templates: true, path: (doc) => `/${String(doc['slug'])}` },
        posts: { context: 'post' },
      },
      mcp: {
        enabled: true,
        collections: ['pages'],
        rateLimiter: {
          hit: () => (blocked ? { allowed: false, retryAfterSeconds: 7 } : { allowed: true }),
        },
      },
    },
    {
      // Only "editor*" users may create pages; every signed-in user may read and update them.
      pageAccess: {
        create: ({ req }) => String((req.user as { email?: string }).email).startsWith('editor'),
        read: ({ req }) => req.user !== null && req.user !== undefined,
        update: ({ req }) => req.user !== null && req.user !== undefined,
      },
      collections: [
        { slug: 'users', admin: { useAsTitle: 'email' }, auth: { useAPIKey: true }, fields: [] },
        {
          slug: 'posts',
          admin: { useAsTitle: 'title' },
          fields: [{ name: 'title', type: 'text' }],
          versions: { drafts: true },
        },
      ],
    },
  );
  await h.payload.create({
    collection: 'users',
    data: {
      email: 'editor-agent@example.com',
      password: 'secret-password',
      enableAPIKey: true,
      apiKey: KEY,
    },
  });
  agent = (method, path, body) =>
    h.call(method, path, {
      token: null,
      headers: { authorization: `users API-Key ${KEY}` },
      ...(body === undefined ? {} : { body }),
    });
});
afterAll(() => h.close());

describe('API-key access', () => {
  it('reaches the session endpoint as the agent user, without publish permission', async () => {
    const session = await agent('GET', '/buildr/session');
    expect(session.status).toBe(200);
    expect(session.body.user.email).toBe('editor-agent@example.com');
    expect(session.body.permissions).toMatchObject({ canEdit: true, canPublish: false });
  });

  it('is refused without a key', async () => {
    const list = await h.call('GET', '/buildr/documents?collection=pages', { token: null });
    expect(list.status).toBe(401);
    const create = await h.call('POST', '/buildr/documents', {
      token: null,
      body: { collection: 'pages', title: 'x' },
    });
    expect(create.status).toBe(401);
  });
});

describe('POST /buildr/documents', () => {
  it('creates a draft that is never published and attributes it to the agent user', async () => {
    const created = await agent('POST', '/buildr/documents', {
      collection: 'pages',
      title: 'About us',
      slug: 'about-us',
    });
    expect(created.status).toBe(201);
    const summary = documentSummarySchema.parse(created.body);
    expect(summary).toMatchObject({
      title: 'About us',
      slug: 'about-us',
      status: 'draft',
      revision: 0,
      layoutSource: 'builtin',
      previewPath: '/about-us',
    });
    const stored = await h.payload.findByID({
      collection: 'pages',
      id: summary.ref.id,
      draft: true,
      depth: 0,
    });
    expect(stored['_status']).toBe('draft');
    expect(stored['buildrUpdatedBy']).toMatchObject({ relationTo: 'users' });
    // The stored (non-draft) document is a draft too: nothing was published.
    const live = await h.payload.findByID({
      collection: 'pages',
      id: summary.ref.id,
      draft: false,
      depth: 0,
    });
    expect(live['_status']).toBe('draft');
  });

  it('answers 403 to a user without create access', async () => {
    const other = await h.login('viewer@example.com');
    const before = (await h.payload.count({ collection: 'pages' })).totalDocs;
    const denied = await h.call('POST', '/buildr/documents', {
      token: other,
      body: { collection: 'pages', title: 'Nope' },
    });
    expect(denied.status).toBe(403);
    expect((await h.payload.count({ collection: 'pages' })).totalDocs).toBe(before);
  });

  it('rejects bodies that do not match the contract and unknown collections', async () => {
    expect((await agent('POST', '/buildr/documents', { collection: 'pages' })).status).toBe(400);
    const badSlug = { collection: 'pages', title: 'x', slug: 'Not OK' };
    expect((await agent('POST', '/buildr/documents', badSlug)).status).toBe(400);
    const unknown = { collection: 'nope', title: 'x' };
    expect((await agent('POST', '/buildr/documents', unknown)).status).toBe(404);
  });

  it('keeps an agent out of collections outside mcp.collections, but not a browser user', async () => {
    const body = { collection: 'posts', title: 'Hello' };
    expect((await agent('POST', '/buildr/documents', body)).status).toBe(403);
    expect((await agent('GET', '/buildr/documents?collection=posts')).status).toBe(403);
    expect((await h.call('POST', '/buildr/documents', { body })).status).toBe(201);
  });

  it('is limited per API-key user; browser sessions are not limited', async () => {
    blocked = true;
    try {
      const limited = await agent('POST', '/buildr/documents', {
        collection: 'pages',
        title: 'Too many',
      });
      expect(limited.status).toBe(429);
      const browser = await h.call('POST', '/buildr/documents', {
        body: { collection: 'pages', title: 'Browser' },
      });
      expect(browser.status).toBe(201);
    } finally {
      blocked = false;
    }
  });
});

describe('GET /buildr/documents', () => {
  it('lists documents with title, slug, status and layout source, and searches', async () => {
    const all = await agent('GET', '/buildr/documents?collection=pages');
    expect(all.status).toBe(200);
    expect(all.body.page).toBe(1);
    const titles = all.body.items.map((item: { title: string }) => item.title);
    expect(titles).toContain('About us');
    expect(documentSummarySchema.parse(all.body.items[0])).toBeDefined();

    const found = await agent('GET', '/buildr/documents?collection=pages&search=about');
    expect(found.body.items.map((item: { title: string }) => item.title)).toEqual(['About us']);
    const none = await agent('GET', '/buildr/documents?collection=pages&search=zzzz');
    expect(none.body.items).toEqual([]);
  });

  it('needs a collection, and a builder collection', async () => {
    expect((await agent('GET', '/buildr/documents')).status).toBe(400);
    expect((await agent('GET', '/buildr/documents?collection=users')).status).toBe(404);
  });
});

describe('writes by an API key', () => {
  it('saves like the editor and stamps buildrUpdatedBy in every version', async () => {
    const created = await agent('POST', '/buildr/documents', {
      collection: 'pages',
      title: 'Save me',
    });
    const { id } = created.body.ref;
    const path = `/buildr/documents/pages/${id}`;
    const save = (baseRevision: number) =>
      agent('PUT', path, { document: withChild(title('Hi')), baseRevision, autosave: false });
    expect((await save(0)).status).toBe(200);
    const versions = await h.payload.findVersions({
      collection: 'pages',
      where: { parent: { equals: id } },
      depth: 0,
      limit: 5,
    });
    expect(versions.docs.length).toBeGreaterThan(0);
    for (const version of versions.docs) {
      expect((version.version as Record<string, unknown>)['buildrUpdatedBy']).toMatchObject({
        relationTo: 'users',
      });
    }
    // The conflict rule is the same as in the editor.
    expect((await save(0)).status).toBe(409);
  });

  it('cannot publish unless mcp.allowPublish is on', async () => {
    const created = await agent('POST', '/buildr/documents', {
      collection: 'pages',
      title: 'Stay draft',
    });
    const { id } = created.body.ref;
    const denied = await agent('POST', `/buildr/documents/pages/${id}/publish`, {
      baseRevision: 0,
    });
    expect(denied.status).toBe(403);
    const stored = await h.payload.findByID({ collection: 'pages', id, draft: true, depth: 0 });
    expect(stored['_status']).toBe('draft');
  });
});
