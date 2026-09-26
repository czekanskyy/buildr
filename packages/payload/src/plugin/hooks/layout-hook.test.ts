import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type BuilderDocument,
  type ComponentMeta,
  createEmptyDocument,
  createRegistryMeta,
  p,
  s,
} from '@next-buildr/core';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { buildConfig, getPayload, handleEndpoints, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildrPlugin } from '../index.ts';
import { BUILDR_WRITE } from '../write-guard.ts';
import { processLayout } from './process-layout.ts';

const widget: ComponentMeta = {
  type: 'buildr/widget',
  version: 2,
  label: 'Widget',
  category: 'content',
  props: { title: p.text({ label: 'Title', default: 'Hello' }) },
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
  slots: {},
};
const page: ComponentMeta = {
  ...widget,
  type: 'buildr/page',
  version: 1,
  label: 'Page',
  props: {},
  capabilities: { root: true },
  slots: { default: {} },
};
const meta = createRegistryMeta({ components: [page, widget] });
// The widget renamed `label` to `title` in version 2.
const migrations = {
  'buildr/page': { currentVersion: 1, steps: [] },
  'buildr/widget': {
    currentVersion: 2,
    steps: [
      {
        from: 1,
        to: 2,
        migrate: (props: Record<string, unknown> | undefined) => {
          const { label, ...rest } = props ?? {};
          return { ...rest, title: label } as never;
        },
      },
    ],
  },
} as never;

const withWidget = (props: Record<string, unknown>, widgetVersion = 2): BuilderDocument =>
  ({
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: ['widget0001'] } },
      widget0001: { id: 'widget0001', type: 'buildr/widget', props },
    },
    components: { 'buildr/page': 1, 'buildr/widget': widgetVersion },
  }) as never;

describe('processLayout', () => {
  const limits = { maxNodes: 5000, maxBytes: 2_000_000 };
  const registry = { meta, migrations };

  it('gives a missing layout the empty document', () => {
    const result = processLayout(undefined, { limits });
    expect(result).toEqual({ ok: true, doc: createEmptyDocument(), warnings: [] });
  });

  it('rejects what is not a document, with a readable message', () => {
    for (const value of ['text', [], { nodes: {} }]) {
      const result = processLayout(value, { limits });
      expect(result.ok).toBe(false);
    }
  });

  it('applies the limits, tightening the defaults only', () => {
    const doc = withWidget({ title: s('a') });
    expect(processLayout(doc, { limits: { maxNodes: 1, maxBytes: 2_000_000 } }).ok).toBe(false);
    expect(processLayout(doc, { limits: { maxNodes: 10 ** 9, maxBytes: 10 ** 9 } }).ok).toBe(true);
  });

  it('migrates components to the current version', () => {
    const result = processLayout(withWidget({ label: s('Old') }, 1), { limits, registry });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.components['buildr/widget']).toBe(2);
    expect(result.doc.nodes['widget0001']?.props?.['title']).toEqual(s('Old'));
  });

  it('rejects a component written by newer code', () => {
    const result = processLayout(withWidget({ title: s('a') }, 9), { limits, registry });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown prop value when a registry is configured', () => {
    const doc = withWidget({ title: { kind: 'static', value: 42 } });
    expect(processLayout(doc, { limits }).ok).toBe(true);
    expect(processLayout(doc, { limits, registry }).ok).toBe(false);
  });
});

let dir: string;
let payload: Payload;
const warn = vi.fn();

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'buildr-payload-hooks-'));
  const config = buildConfig({
    secret: 'test-secret',
    collections: [
      {
        slug: 'pages',
        fields: [{ name: 'title', type: 'text' }],
        versions: { drafts: { autosave: true } },
      },
    ],
    db: sqliteAdapter({ client: { url: `file:${join(dir, 'db.sqlite')}` } }),
    plugins: [
      buildrPlugin({ collections: { pages: { context: 'page' } }, registry: { meta, migrations } }),
    ],
    typescript: { autoGenerate: false },
  });
  payload = await getPayload({ config, key: 'layout-hook' });
  payload.logger.warn = warn as never;
});
afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows keeps the database file open a moment longer.
  }
});

describe('the layout hook', () => {
  const write = (data: Record<string, unknown>, id?: number | string) =>
    id === undefined
      ? payload.create({ collection: 'pages', data, draft: true })
      : payload.update({
          collection: 'pages',
          id,
          data,
          draft: true,
          context: { [BUILDR_WRITE]: true },
        });
  const layoutOf = async (id: number | string) =>
    (
      (await payload.findByID({ collection: 'pages', id, draft: true })) as unknown as {
        layout: BuilderDocument;
      }
    ).layout;

  it('creates a document with the empty layout', async () => {
    const doc = await write({ title: 'New' });
    expect(await layoutOf(doc.id)).toEqual(createEmptyDocument());
  });

  it('rejects an invalid layout through the Local API, naming the field', async () => {
    await expect(write({ title: 'Bad', layout: { schemaVersion: 1, nodes: {} } })).rejects.toThrow(
      /layout/i,
    );
    const doc = await write({ title: 'Ok' });
    const rejected = await write({ layout: 'nonsense' }, doc.id).catch((error: unknown) => error);
    expect(
      (rejected as { data?: { errors?: { message: string }[] } }).data?.errors?.[0]?.message,
    ).toMatch(/document object/);
    expect(await layoutOf(doc.id)).toEqual(createEmptyDocument());
  });

  it('migrates on save', async () => {
    const doc = await write({ title: 'Migrating' });
    await write({ layout: withWidget({ label: s('Old') }, 1) }, doc.id);
    const stored = await layoutOf(doc.id);
    expect(stored.components['buildr/widget']).toBe(2);
    expect(stored.nodes['widget0001']?.props?.['title']).toEqual(s('Old'));
  });

  it('rejects an invalid layout over REST with a readable field error', async () => {
    await payload.create({
      collection: 'users',
      data: { email: 'editor@example.com', password: 'secret-password' },
    });
    const login = await payload.login({
      collection: 'users',
      data: { email: 'editor@example.com', password: 'secret-password' },
    });
    const response = await handleEndpoints({
      config: payload.config,
      request: new Request('http://localhost/api/pages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `JWT ${login.token}` },
        body: JSON.stringify({
          title: 'Rest',
          layout: { schemaVersion: 1, root: 'root', nodes: {} },
        }),
      }),
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    const body = (await response.json()) as {
      errors: { data?: { errors?: { path: string; message: string }[] } }[];
    };
    const field = body.errors[0]?.data?.errors?.[0];
    expect(field?.path).toBe('layout');
    expect(field?.message.length).toBeGreaterThan(10);
  });

  it('does not validate a layout that the write-guard keeps', async () => {
    const doc = await write({ title: 'Kept' });
    await payload.update({
      collection: 'pages',
      id: doc.id,
      data: { title: 'Renamed', layout: 'garbage' },
      draft: true,
    });
    expect(await layoutOf(doc.id)).toEqual(createEmptyDocument());
  });
});
