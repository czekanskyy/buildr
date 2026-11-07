import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEmptyDocument, createRegistryMeta } from '@next-buildr/core';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { buildConfig, type CollectionConfig, type Config, getPayload, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildrPlugin } from './index.ts';
import { type BuildrPluginOptions, resolveOptions } from './options.ts';
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

describe('captcha options', () => {
  const secret = 'never-echo-this-secret';
  const valid = {
    collections: {},
    forms: {
      enabled: true,
      clientIp: { header: 'trusted-ip' },
      captcha: { secretKey: secret, hostnames: ['example.com'] },
    },
  };
  it('ignores unknown forms keys as before', () => {
    expect(
      resolveOptions({ collections: {}, forms: { legacy: true } } as BuildrPluginOptions).forms
        .enabled,
    ).toBe(false);
  });
  it('keeps verifier implementation out of the public entry', async () => {
    const entry = await import('./index.ts');
    expect(entry).not.toHaveProperty('createTurnstileVerifier');
  });
  it('serialises no captcha secret and preserves the host onInit hook', async () => {
    const onInit = vi.fn();
    const config = await buildrPlugin({
      ...valid,
      registry: { meta: createRegistryMeta({ components: [] }) },
    } as BuildrPluginOptions)({ collections: [], onInit } as unknown as Config);
    expect(JSON.stringify(config)).not.toContain(secret);
    const payload = { logger: { error: vi.fn(), warn: vi.fn() } } as unknown as Payload;
    await config.onInit?.(payload);
    expect(onInit).toHaveBeenCalledExactlyOnceWith(payload);
  });
  it('applies provider, concurrency and trusted hop defaults; accepts a request callback', () => {
    expect(resolveOptions(valid).forms).toMatchObject({
      captcha: { provider: 'turnstile', maxInFlight: 16 },
      clientIp: { hops: 1 },
    });
    const callback = () => '192.0.2.1';
    expect(
      resolveOptions({ ...valid, forms: { ...valid.forms, clientIp: callback } }).forms.clientIp,
    ).toBe(callback);
  });
  it.each([
    { enabled: false },
    { clientIp: undefined },
    { captcha: { secretKey: secret } },
    { captcha: { secretKey: secret, hostnames: [] } },
    ...[
      '.',
      '..',
      '-',
      'example.com.',
      '-example.com',
      'example-.com',
      `${'a'.repeat(64)}.com`,
      'EXAMPLE.COM',
      'https://example.com',
      'example.com:443',
      'example.com/path',
      'a'.repeat(254),
      'example.com\n',
    ].map((hostname) => ({ captcha: { secretKey: secret, hostnames: [hostname] } })),
    ...[0, 1.5, 1025].map((maxInFlight) => ({ captcha: { ...valid.forms.captcha, maxInFlight } })),
    { captcha: { ...valid.forms.captcha, secretKey: '' } },
    { captcha: { ...valid.forms.captcha, provider: 'other' } },
    { captcha: { ...valid.forms.captcha, verifier: { verify() {} } } },
    { captcha: { ...valid.forms.captcha, [secret]: true } },
    ...['X-Forwarded-For', '', 'a b', 'valid\n', 'x'.repeat(65)].map((header) => ({
      clientIp: { header },
    })),
    ...[0, -1, 1.5].map((hops) => ({ clientIp: { header: 'trusted-ip', hops } })),
  ])('rejects invalid captcha configuration without exposing the secret', (change) => {
    let message = '';
    try {
      resolveOptions({ ...valid, forms: { ...valid.forms, ...change } } as BuildrPluginOptions);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('buildrPlugin: invalid options');
    expect(message).not.toContain(secret);
  });
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
      path: '@next-buildr/payload/admin#LayoutField',
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

describe('buildrPlugin mcp option', () => {
  const collections = { pages: { context: 'page' } };
  const users = (auth: NonNullable<CollectionConfig['auth']>): CollectionConfig => ({
    slug: 'users',
    auth,
    fields: [],
  });

  it('is off by default and needs no API-key collection then', async () => {
    const config = await configOf({ collections }, [pages]);
    const page = config.collections.find((c) => c.slug === 'pages');
    expect(page?.fields.some((f) => 'name' in f && f.name === 'buildrUpdatedBy')).toBe(false);
  });

  it('requires an auth collection with useAPIKey when enabled', async () => {
    await expect(
      configOf({ collections, mcp: { enabled: true } }, [pages, users(true)]),
    ).rejects.toThrow(/useAPIKey/);
  });

  it('adds buildrUpdatedBy when enabled', async () => {
    const config = await configOf({ collections, mcp: { enabled: true } }, [
      pages,
      users({ useAPIKey: true }),
    ]);
    const page = config.collections.find((c) => c.slug === 'pages');
    expect(page?.fields.some((f) => 'name' in f && f.name === 'buildrUpdatedBy')).toBe(true);
  });

  it('rejects mcp.collections that are not builder collections', async () => {
    await expect(
      configOf({ collections, mcp: { enabled: true, collections: ['posts'] } }, [
        pages,
        users({ useAPIKey: true }),
      ]),
    ).rejects.toThrow(/mcp\.collections "posts"/);
  });
});
