import { createEmptyDocument, s } from '@buildr/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  documentResponseSchema,
  publishResponseSchema,
  saveResponseSchema,
  sessionResponseSchema,
} from '../../contract.ts';
import { boot, type Harness, title, withChild } from './endpoints.test-kit.ts';

let h: Harness;
beforeAll(async () => {
  h = await boot('endpoints');
});
afterAll(() => h.close());

const create = async (data: Record<string, unknown> = {}) => {
  const doc = await h.payload.create({
    collection: 'pages',
    data: { title: 'Home', slug: 'home', ...data },
    draft: true,
  });
  return Number(doc.id);
};
const path = (docId: number, suffix = '') => `/buildr/documents/pages/${docId}${suffix}`;
const save = (docId: number, revision: number, document: unknown, autosave = false) =>
  h.call('PUT', path(docId), { body: { document, baseRevision: revision, autosave } });
type Nodes = Record<string, { props?: unknown }>;
const nodesOf = (document: unknown) => (document as { nodes: Nodes }).nodes;

describe('authentication', () => {
  it('answers 401 to every endpoint without a user', async () => {
    const id = await create();
    const anonymous = { token: null };
    const calls = await Promise.all([
      h.call('GET', '/buildr/session', anonymous),
      h.call('GET', '/buildr/manifest', anonymous),
      h.call('GET', path(id), anonymous),
      h.call('PUT', path(id), { ...anonymous, body: {} }),
      h.call('POST', path(id, '/publish'), { ...anonymous, body: {} }),
    ]);
    expect(calls.map((call) => call.status)).toEqual([401, 401, 401, 401, 401]);
  });
});

describe('session and manifest', () => {
  it('describes the user, what they may do and the limits', async () => {
    const { status, body } = await h.call('GET', '/buildr/session');
    expect(status).toBe(200);
    const session = sessionResponseSchema.parse(body);
    expect(session.user.email).toBe('editor@example.com');
    expect(session.permissions).toEqual({
      canEdit: true,
      canPublish: true,
      canUnlockTemplates: true,
    });
    expect(session.limits).toEqual({ maxNodes: 5000, maxBytes: 2_000_000 });
  });

  it('serves the manifest of the registry', async () => {
    const { status, body } = await h.call('GET', '/buildr/manifest');
    expect(status).toBe(200);
    expect(typeof body.hash).toBe('string');
  });
});

describe('GET a document', () => {
  it('opens a new document as an empty one at revision 0', async () => {
    const docId = await create();
    const { status, body } = await h.call('GET', path(docId));
    expect(status).toBe(200);
    const doc = documentResponseSchema.parse(body);
    expect(doc).toMatchObject({
      ref: { collection: 'pages', id: String(docId) },
      title: 'Home',
      slug: 'home',
      status: 'draft',
      revision: 0,
      contextRef: `pages:${docId}`,
      previewPath: '/home',
    });
    expect(doc.document).toEqual(createEmptyDocument());
    expect(doc.readOnly).toBeUndefined();
  });

  it('answers 404 for a collection or a document that does not exist', async () => {
    expect((await h.call('GET', '/buildr/documents/nope/1')).status).toBe(404);
    expect((await h.call('GET', path(99999))).status).toBe(404);
  });

  it('marks a document that newer code wrote as read-only, and leaves it untouched', async () => {
    const docId = await create();
    // Straight into the database: the hooks would (rightly) refuse to store this.
    await h.payload.db.createVersion({
      collectionSlug: 'pages',
      parent: docId,
      versionData: {
        title: 'Newer',
        layout: withChild(title('x'), { version: 9 }),
        buildrRevision: 4,
        _status: 'draft',
      } as never,
      createdAt: new Date().toISOString(),
      updatedAt: new Date(Date.now() + 1000).toISOString(),
      autosave: false,
      returning: false,
    });
    const { body } = await h.call('GET', path(docId));
    expect(body.readOnly).toBe(true);
    expect(body.revision).toBe(4);
    expect(body.document.components['buildr/widget']).toBe(9);
  });
});

describe('PUT a document (save)', () => {
  it('saves, bumps the revision and stores the layout', async () => {
    const docId = await create();
    const { status, body } = await save(docId, 0, withChild(title('One')));
    expect(status).toBe(200);
    expect(saveResponseSchema.parse(body).revision).toBe(1);
    const opened = documentResponseSchema.parse((await h.call('GET', path(docId))).body);
    expect(opened.revision).toBe(1);
    expect(nodesOf(opened.document)['child00001']?.props).toEqual(title('One'));
  });

  it('answers 409 with the current revision when the base is stale', async () => {
    const docId = await create();
    expect((await save(docId, 0, withChild(title('One')))).status).toBe(200);
    const stale = await save(docId, 0, withChild(title('Two')));
    expect(stale).toEqual({ status: 409, body: { currentRevision: 1 } });
  });

  it('answers 422 with diagnostics for an invalid document, and stores nothing', async () => {
    const docId = await create();
    const invalid = await save(docId, 0, withChild({ title: { kind: 'static', value: 42 } }));
    expect(invalid.status).toBe(422);
    expect(invalid.body.diagnostics.length).toBeGreaterThan(0);
    expect((await save(docId, 0, { schemaVersion: 1 })).status).toBe(422);
    expect(documentResponseSchema.parse((await h.call('GET', path(docId))).body).revision).toBe(0);
  });

  it('answers 400 to a body that is not the contract', async () => {
    const docId = await create();
    expect((await h.call('PUT', path(docId), { body: { document: {} } })).status).toBe(400);
  });

  it('keeps one autosave version, but every explicit save is a version', async () => {
    const docId = await create();
    const versions = async () =>
      (await h.payload.countVersions({ collection: 'pages', where: { parent: { equals: docId } } }))
        .totalDocs;
    const before = await versions();
    await save(docId, 0, withChild(title('a')), true);
    await save(docId, 1, withChild(title('b')), true);
    await save(docId, 2, withChild(title('c')), true);
    const afterAutosaves = await versions();
    expect(afterAutosaves - before).toBeLessThanOrEqual(1);
    await save(docId, 3, withChild(title('d')), false);
    await save(docId, 4, withChild(title('e')), false);
    expect((await versions()) - afterAutosaves).toBe(2);
  });

  it('never loses either side of concurrent admin and builder edits', async () => {
    const docId = await create({ title: 'Original' });
    await save(docId, 0, withChild(title('Built')), true);
    // The admin form still holds the layout it loaded, and saves a new title.
    await h.payload.update({
      collection: 'pages',
      id: docId,
      data: { title: 'Renamed', layout: createEmptyDocument(), buildrRevision: 0 },
      draft: true,
      autosave: true,
    });
    const opened = documentResponseSchema.parse((await h.call('GET', path(docId))).body);
    expect(opened.title).toBe('Renamed');
    expect(opened.revision).toBe(1);
    expect(nodesOf(opened.document)['child00001']?.props).toEqual({ title: s('Built') });
  });
});

describe('POST publish', () => {
  it('publishes the latest draft, all of it', async () => {
    const docId = await create({ title: 'Draft title' });
    await save(docId, 0, withChild(title('Live')));
    await h.payload.update({
      collection: 'pages',
      id: docId,
      data: { title: 'Admin edit' },
      draft: true,
    });
    const { status, body } = await h.call('POST', path(docId, '/publish'), {
      body: { baseRevision: 1 },
    });
    expect(status).toBe(200);
    expect(publishResponseSchema.parse(body)).toMatchObject({ status: 'published', revision: 1 });
    const published = (await h.payload.findByID({
      collection: 'pages',
      id: docId,
    })) as unknown as { _status: string; title: string; layout: { nodes: Nodes } };
    expect(published._status).toBe('published');
    expect(published.title).toBe('Admin edit');
    expect(published.layout.nodes['child00001']?.props).toEqual(title('Live'));
    const opened = documentResponseSchema.parse((await h.call('GET', path(docId))).body);
    expect(opened.status).toBe('published');
    expect(opened.revision).toBe(1);
  });

  it('answers 409 for a stale revision, and 404 for a missing document', async () => {
    const docId = await create();
    await save(docId, 0, withChild(title('One')));
    const stale = await h.call('POST', path(docId, '/publish'), { body: { baseRevision: 0 } });
    expect(stale.status).toBe(409);
    const missing = await h.call('POST', path(99999, '/publish'), { body: { baseRevision: 0 } });
    expect(missing.status).toBe(404);
  });
});
