import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type BuilderDocument, s } from '@next-buildr/core';
import { buildrPlugin, processLayout } from '@next-buildr/payload/plugin';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { buildConfig, getPayload, handleEndpoints, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registry } from './buildr.registry.ts';

// The write path and the read path of the plugin against the real component library: documents
// stored before `buildr/section` and `buildr/stack` were retired (ADR-025).

const limits = { maxNodes: 5000, maxBytes: 2_000_000 };

/** A page holding a section that holds a stack that holds a heading, all stored at version 1. */
const legacy = (): BuilderDocument =>
  ({
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: ['sec0000001'] } },
      sec0000001: {
        id: 'sec0000001',
        type: 'buildr/section',
        props: { container: s('md'), ariaLabel: s('Intro') },
        slots: { default: ['stk0000001'] },
      },
      stk0000001: {
        id: 'stk0000001',
        type: 'buildr/stack',
        styles: { base: { layout: { gap: '2rem' } } },
        slots: { default: ['hd00000001'] },
      },
      hd00000001: {
        id: 'hd00000001',
        type: 'buildr/heading',
        props: { text: s('Hello'), level: s(1) },
      },
    },
    components: {
      'buildr/page': 1,
      'buildr/section': 1,
      'buildr/stack': 1,
      'buildr/heading': 1,
    },
  }) as never;

/** A container stored by newer code than this build knows. */
const fromTheFuture = (): BuilderDocument => {
  const document = legacy();
  return {
    ...document,
    nodes: {
      root: document.nodes['root']!,
      sec0000001: { id: 'sec0000001', type: 'buildr/container', props: {}, slots: { default: [] } },
    },
    components: { 'buildr/page': 1, 'buildr/container': 3 },
  } as never;
};

let dir: string;
let payload: Payload;
let token: string;

const call = async (method: string, path: string, body?: unknown) => {
  const response = await handleEndpoints({
    config: payload.config,
    request: new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        authorization: `JWT ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  });
  const text = await response.text();
  return { status: response.status, body: text === '' ? undefined : JSON.parse(text) };
};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'buildr-example-layout-'));
  const config = buildConfig({
    secret: 'test-secret',
    collections: [
      {
        slug: 'pages',
        admin: { useAsTitle: 'title' },
        fields: [{ name: 'title', type: 'text' }],
        versions: { drafts: { autosave: true } },
      },
    ],
    db: sqliteAdapter({ client: { url: `file:${join(dir, 'db.sqlite')}` } }),
    plugins: [
      buildrPlugin({
        collections: { pages: { context: 'page' } },
        registry: { meta: registry.meta, migrations: registry.migrations },
      }),
    ],
    typescript: { autoGenerate: false },
  });
  payload = await getPayload({ config, key: 'example-layout-migration' });
  await payload.create({
    collection: 'users',
    data: { email: 'editor@example.com', password: 'secret-password' },
  });
  const login = await payload.login({
    collection: 'users',
    data: { email: 'editor@example.com', password: 'secret-password' },
  });
  token = login.token as string;
});
afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows keeps the database file open a moment longer.
  }
});

const create = async () =>
  Number((await payload.create({ collection: 'pages', data: { title: 'Page' }, draft: true })).id);

/** Puts a layout into the stored row as it is, past the plugin's hooks: a row written by older code. */
async function storeRaw(id: number, layout: unknown): Promise<void> {
  const json = JSON.stringify(layout);
  const client = (
    payload.db as unknown as { client: { execute: (q: unknown) => Promise<unknown> } }
  ).client;
  await client.execute({ sql: 'UPDATE pages SET layout = ? WHERE id = ?', args: [json, id] });
  await client.execute({
    sql: 'UPDATE _pages_v SET version_layout = ? WHERE parent_id = ?',
    args: [json, id],
  });
}

/** Every row of the base table and of the versions table, as they are in the database. */
async function rawRows(): Promise<{ pages: unknown[]; versions: unknown[] }> {
  const client = (
    payload.db as unknown as {
      client: { execute: (q: string) => Promise<{ rows: unknown[] }> };
    }
  ).client;
  const rows = async (table: string) =>
    (await client.execute(`SELECT * FROM ${table} ORDER BY id`)).rows.map((row) => ({
      ...(row as object),
    }));
  return { pages: await rows('pages'), versions: await rows('_pages_v') };
}

const stored = async (id: number): Promise<{ layout: unknown; revision: unknown }> => {
  const doc = (await payload.findByID({ collection: 'pages', id, draft: true })) as unknown as {
    layout: unknown;
    buildrRevision: unknown;
  };
  return { layout: doc.layout, revision: doc.buildrRevision };
};
const path = (id: number) => `/buildr/documents/pages/${id}`;
const revisionOf = async (id: number) =>
  ((await call('GET', path(id))).body as { revision: number }).revision;
const typesOf = (document: BuilderDocument) =>
  Object.values(document.nodes)
    .map((node) => node.type)
    .sort();

describe('layout writes against the default registry', () => {
  it('persists a document with a stack and a section as containers', async () => {
    const id = await create();
    const saved = await call('PUT', path(id), {
      document: legacy(),
      baseRevision: await revisionOf(id),
      autosave: false,
    });
    expect(saved.status).toBe(200);

    const { layout } = await stored(id);
    const document = layout as BuilderDocument;
    expect(typesOf(document)).toEqual([
      'buildr/container',
      'buildr/container',
      'buildr/heading',
      'buildr/page',
    ]);
    expect(document.components['buildr/container']).toBe(2);
    expect(document.components).not.toHaveProperty('buildr/section');
    expect(document.components).not.toHaveProperty('buildr/stack');
    expect(document.nodes['sec0000001']?.props?.['bleed']).toEqual(s(true));
    expect(document.nodes['stk0000001']?.props?.['width']).toEqual(s('none'));
  });

  it('refuses a container stored at a newer version and leaves the row unchanged', async () => {
    const id = await create();
    await call('PUT', path(id), {
      document: legacy(),
      baseRevision: await revisionOf(id),
      autosave: false,
    });
    const before = await stored(id);
    const rowsBefore = await rawRows();

    const refused = await call('PUT', path(id), {
      document: fromTheFuture(),
      baseRevision: await revisionOf(id),
      autosave: false,
    });
    expect(refused.status).toBe(422);
    expect(refused.body.diagnostics.length).toBeGreaterThan(0);
    expect(await stored(id)).toEqual(before);
    expect(await rawRows()).toEqual(rowsBefore);
  });
});

describe('layout reads against the default registry', () => {
  it('migrates a row stored before the retirement in memory and writes nothing', async () => {
    const id = await create();
    await storeRaw(id, legacy());
    const before = await stored(id);
    const rowsBefore = await rawRows();

    const read = await call('GET', path(id));
    expect(read.status).toBe(200);
    expect(read.body.readOnly).toBeUndefined();
    expect(typesOf(read.body.document)).not.toContain('buildr/section');
    expect(typesOf(read.body.document)).not.toContain('buildr/stack');
    expect(read.body.document.components['buildr/container']).toBe(2);
    expect(await stored(id)).toEqual(before);
    expect(await rawRows()).toEqual(rowsBefore);
    expect((before.layout as BuilderDocument).components).toHaveProperty('buildr/section');
  });

  it('opens a container from the future read-only, as stored', async () => {
    const id = await create();
    const future = fromTheFuture();
    await storeRaw(id, future);

    const read = await call('GET', path(id));
    expect(read.status).toBe(200);
    expect(read.body.readOnly).toBe(true);
    expect(read.body.document).toEqual(future);
  });

  it('read, save, read gives the same document, and saving again changes nothing', async () => {
    const id = await create();
    await storeRaw(id, legacy());

    const first = await call('GET', path(id));
    const saved = await call('PUT', path(id), {
      document: first.body.document,
      baseRevision: first.body.revision,
      autosave: false,
    });
    expect(saved.status).toBe(200);
    const second = await call('GET', path(id));
    expect(second.body.document).toEqual(first.body.document);
    expect((await stored(id)).layout).toEqual(first.body.document);

    const again = await call('PUT', path(id), {
      document: second.body.document,
      baseRevision: second.body.revision,
      autosave: false,
    });
    expect(again.status).toBe(200);
    expect((await stored(id)).layout).toEqual(first.body.document);
  });

  it('processLayout is idempotent on its own output', () => {
    const options = { limits, registry: { meta: registry.meta, migrations: registry.migrations } };
    const once = processLayout(legacy(), options);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const twice = processLayout(once.doc, options);
    expect(twice.ok).toBe(true);
    if (twice.ok) expect(twice.doc).toEqual(once.doc);
  });
});
