import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEmptyDocument } from '@buildr/core';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { buildConfig, type CollectionConfig, getPayload, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildrPlugin } from './index.ts';
import { BUILDR_WRITE } from './write-guard.ts';

const pages: CollectionConfig = {
  slug: 'pages',
  fields: [{ name: 'title', type: 'text' }],
  versions: { drafts: { autosave: true } },
};
const layoutOf = (name: string) => ({
  ...createEmptyDocument(),
  nodes: { root: { id: 'root', type: 'buildr/page', name } },
});

let dir: string;
const configOf = (options: Parameters<typeof buildrPlugin>[0], collections = [pages]) =>
  buildConfig({
    secret: 'test-secret',
    collections,
    db: sqliteAdapter({
      client: { url: `file:${join(dir, `${Math.random().toString(36).slice(2)}.db`)}` },
    }),
    plugins: [buildrPlugin(options)],
    typescript: { autoGenerate: false },
  });
// Only the write-guard suite talks to a database: Payload pushes the schema through one shared
// drizzle-kit state, so a second live instance in the same process would find no tables.
const boot = async (options: Parameters<typeof buildrPlugin>[0]) =>
  getPayload({ config: configOf(options), key: 'write-guard' });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'buildr-payload-'));
});
afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows keeps the database file open a moment longer; the temp dir is cleaned by the OS.
  }
});

describe('buildrPlugin', () => {
  it('adds the fields to the configured collections only', async () => {
    const config = await configOf({ collections: { pages: { context: 'page', templates: true } } });
    const names = (slug: string) =>
      config.collections
        .find((collection) => collection.slug === slug)
        ?.fields.map((field) => (field as { name?: string }).name);
    expect(names('pages')).toEqual(
      expect.arrayContaining(['layout', 'buildrRevision', 'template']),
    );
    expect(names('buildr-templates')).toEqual(
      expect.arrayContaining(['title', 'targetCollection', 'isDefault', 'layout']),
    );
    const layout = config.collections[0]?.fields.find(
      (field) => (field as { name?: string }).name === 'layout',
    ) as { admin?: { components?: { Field?: { path: string; clientProps: unknown } } } };
    expect(layout.admin?.components?.Field).toEqual({
      path: '@buildr/payload/admin#LayoutField',
      clientProps: { editorRoute: '/buildr/edit' },
    });
  });

  it('leaves out the template field unless the collection takes templates', async () => {
    const config = await configOf({ collections: { pages: { context: 'page' } } });
    const names = config.collections[0]?.fields.map((field) => (field as { name?: string }).name);
    expect(names).not.toContain('template');
  });

  it('adds buildr-templates only when a collection takes templates, and never twice', async () => {
    const without = await configOf({ collections: { pages: { context: 'page' } } });
    expect(without.collections.map((collection) => collection.slug)).not.toContain(
      'buildr-templates',
    );
    await expect(
      configOf({ collections: { pages: { context: 'page', templates: true } } }, [
        pages,
        { slug: 'buildr-templates', fields: [] },
      ]),
    ).rejects.toThrow(/added by the plugin/);
  });

  it('rejects bad options, listing each problem', () => {
    expect(() =>
      buildrPlugin({ collections: { pages: { context: '' } }, limits: { maxNodes: -1 } }),
    ).toThrow(/collections\.pages\.context[\s\S]*limits\.maxNodes/);
  });

  it('requires an existing collection with drafts and free field names', async () => {
    await expect(configOf({ collections: { nope: { context: 'x' } } })).rejects.toThrow(
      /"nope" does not exist/,
    );
    await expect(
      configOf({ collections: { plain: { context: 'x' } } }, [{ slug: 'plain', fields: [] }]),
    ).rejects.toThrow(/versions\.drafts/);
    await expect(
      configOf({ collections: { pages: { context: 'x' } } }, [
        { ...pages, fields: [{ name: 'layout', type: 'text' }] },
      ]),
    ).rejects.toThrow(/already has a "layout" field/);
  });

  describe('write-guard', () => {
    let payload: Payload;
    beforeAll(async () => {
      payload = await boot({ collections: { pages: { context: 'page' } } });
    });

    const create = () =>
      payload.create({
        collection: 'pages',
        data: { title: 'One', layout: layoutOf('a'), buildrRevision: 1 },
        draft: true,
      });
    const latest = async (id: number | string) => {
      const found = await payload.findByID({ collection: 'pages', id, draft: true });
      return found as unknown as { title: string; layout: unknown; buildrRevision: number };
    };

    it('accepts the layout when the document is created', async () => {
      const doc = await create();
      expect((await latest(doc.id)).layout).toEqual(layoutOf('a'));
    });

    it('never changes the layout for an update that is not the builder', async () => {
      const doc = await create();
      // What the admin form does: it resubmits the layout it loaded, next to the edited title.
      await payload.update({
        collection: 'pages',
        id: doc.id,
        data: { title: 'Two', layout: layoutOf('stale'), buildrRevision: 99 },
        draft: true,
      });
      const after = await latest(doc.id);
      expect(after.title).toBe('Two');
      expect(after.layout).toEqual(layoutOf('a'));
      expect(after.buildrRevision).toBe(1);
    });

    it('keeps the builder edits when the admin saves afterwards (drafts and autosave)', async () => {
      const doc = await create();
      await payload.update({
        collection: 'pages',
        id: doc.id,
        data: { layout: layoutOf('built'), buildrRevision: 2 },
        draft: true,
        autosave: true,
        context: { [BUILDR_WRITE]: true },
      });
      await payload.update({
        collection: 'pages',
        id: doc.id,
        data: { title: 'Renamed', layout: layoutOf('a'), buildrRevision: 1 },
        draft: true,
        autosave: true,
      });
      const after = await latest(doc.id);
      expect(after.title).toBe('Renamed');
      expect(after.layout).toEqual(layoutOf('built'));
      expect(after.buildrRevision).toBe(2);
    });

    it('protects the layout when the admin publishes too', async () => {
      const doc = await create();
      await payload.update({
        collection: 'pages',
        id: doc.id,
        data: { layout: layoutOf('built'), buildrRevision: 2 },
        draft: true,
        context: { [BUILDR_WRITE]: true },
      });
      await payload.update({
        collection: 'pages',
        id: doc.id,
        data: { title: 'Live', layout: layoutOf('a'), _status: 'published' },
        draft: false,
      });
      const published = (await payload.findByID({
        collection: 'pages',
        id: doc.id,
      })) as unknown as {
        layout: unknown;
      };
      expect(published.layout).toEqual(layoutOf('built'));
    });
  });
});
