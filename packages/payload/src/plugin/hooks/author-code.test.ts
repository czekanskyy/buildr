import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  p,
  s,
} from '@next-buildr/core';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { buildConfig, getPayload, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authorCodePermitted } from '../access.ts';
import { buildrPlugin } from '../index.ts';
import { resolveOptions } from '../options.ts';
import { BUILDR_WRITE } from '../write-guard.ts';
import { processLayout } from './process-layout.ts';

// Author code (ADR-026) is a server-side capability: the plugin `authorCode` option, resolved per
// request, enforced on every write of a layout (the hook, the save endpoint, templates).

const widget: ComponentMeta = {
  type: 'buildr/widget',
  version: 1,
  label: 'Widget',
  category: 'content',
  props: {
    title: p.text({ label: 'Title', default: 'Hello' }),
    html: p.textarea({ format: 'html' }),
  },
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
  slots: {},
};
const page: ComponentMeta = {
  ...widget,
  type: 'buildr/page',
  label: 'Page',
  props: {},
  capabilities: { root: true },
  slots: { default: {} },
};
const meta = createRegistryMeta({ components: [page, widget] });

const withAuthor = (extra: Record<string, unknown>, props: Record<string, unknown> = {}) =>
  ({
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: ['widget0001'] } },
      widget0001: {
        id: 'widget0001',
        type: 'buildr/widget',
        props: { title: s('a'), ...props },
        ...extra,
      },
    },
    components: { 'buildr/page': 1, 'buildr/widget': 1 },
  }) as never;

const RED = { customCss: '& { color: red }' };
const BLUE = { customCss: '& { color: blue }' };
const HTML = { html: s('<p>x</p>') };
const codes = (result: ReturnType<typeof processLayout>) =>
  result.ok ? [] : result.diagnostics.map((diagnostic) => diagnostic.code);

describe('processLayout and author code', () => {
  const limits = { maxNodes: 5000, maxBytes: 2_000_000 };
  const registry = { meta };

  it.each([
    ['custom CSS', withAuthor(RED)],
    ['classes', withAuthor({ classes: ['x'] })],
    ['attributes', withAuthor({ attributes: { 'data-x': '1' } })],
    ['an HTML prop', withAuthor({}, HTML)],
  ])('rejects %s unless the request may write author code', (_name, doc) => {
    expect(codes(processLayout(doc, { limits, registry }))).toEqual(['author.not-permitted']);
    expect(codes(processLayout(doc, { limits, registry, allowAuthorCode: false }))).toEqual([
      'author.not-permitted',
    ]);
    expect(processLayout(doc, { limits, registry, allowAuthorCode: true }).ok).toBe(true);
  });

  it('accepts a document without author code', () => {
    expect(processLayout(withAuthor({}), { limits, registry }).ok).toBe(true);
  });

  it('still checks the code itself when it is permitted', () => {
    const bad = withAuthor({ customCss: '@import "x";' });
    expect(codes(processLayout(bad, { limits, registry, allowAuthorCode: true }))).toEqual([
      'author.invalid',
    ]);
  });

  it('lets stored author code be saved unchanged and removed, never added or changed', () => {
    const stored = withAuthor(RED, HTML);
    const options = { limits, registry, previous: stored };
    expect(processLayout(stored, options).ok).toBe(true);
    // removed
    expect(processLayout(withAuthor({}), options).ok).toBe(true);
    // changed or added
    expect(codes(processLayout(withAuthor(BLUE, HTML), options))).toEqual(['author.not-permitted']);
    expect(codes(processLayout(withAuthor(RED, { html: s('<p>y</p>') }), options))).toEqual([
      'author.not-permitted',
    ]);
    expect(codes(processLayout(withAuthor({ ...RED, classes: ['c'] }, HTML), options))).toEqual([
      'author.not-permitted',
    ]);
    // nothing stored, or a stored value that is not a document, excuses nothing
    expect(
      codes(processLayout(stored, { limits, registry, previous: withAuthor({}, {}) })),
    ).toEqual(['author.not-permitted']);
    expect(codes(processLayout(stored, { limits, registry, previous: 'nonsense' }))).toEqual([
      'author.not-permitted',
    ]);
    expect(codes(processLayout(stored, { limits, registry, previous: undefined }))).toEqual([
      'author.not-permitted',
    ]);
  });
});

describe('processLayout without a registry', () => {
  // With no registry the html props of a component are unknown; the names Text uses are still guarded.
  const limits = { maxNodes: 5000, maxBytes: 2_000_000 };

  it.each([
    ['an html prop', withAuthor({}, HTML)],
    ['mode html', withAuthor({}, { mode: s('html') })],
    ['html and mode html', withAuthor({}, { mode: s('html'), ...HTML })],
    ['a bound html prop', withAuthor({}, { html: { kind: 'binding', path: 'page.title' } })],
  ])('rejects %s unless the request may write author code', (_name, doc) => {
    expect(codes(processLayout(doc, { limits }))).toEqual(['author.not-permitted']);
    expect(codes(processLayout(doc, { limits, allowAuthorCode: false }))).toEqual([
      'author.not-permitted',
    ]);
    expect(processLayout(doc, { limits, allowAuthorCode: true }).ok).toBe(true);
  });

  it('still rejects node fields, and accepts a plain document or a plain Text mode', () => {
    expect(codes(processLayout(withAuthor(RED), { limits }))).toEqual(['author.not-permitted']);
    expect(processLayout(withAuthor({}), { limits }).ok).toBe(true);
    expect(processLayout(withAuthor({}, { mode: s('plain') }), { limits }).ok).toBe(true);
  });

  it('lets stored html be saved unchanged and removed, never added or changed', () => {
    const stored = withAuthor({}, { mode: s('html'), ...HTML });
    const options = { limits, previous: stored };
    expect(processLayout(stored, options).ok).toBe(true);
    expect(processLayout(withAuthor({}, { mode: s('plain') }), options).ok).toBe(true);
    expect(
      codes(processLayout(withAuthor({}, { mode: s('html'), html: s('<p>y</p>') }), options)),
    ).toEqual(['author.not-permitted']);
    expect(codes(processLayout(withAuthor({}, { mode: s('html') }), { limits }))).toEqual([
      'author.not-permitted',
    ]);
    expect(
      codes(processLayout(stored, { limits, previous: withAuthor({}, { title: s('x') }) })),
    ).toEqual(['author.not-permitted']);
  });
});

describe('the authorCode option needs a registry', () => {
  it('refuses anything but false at startup, like forms', () => {
    expect(() => buildrPlugin({ collections: {}, authorCode: true })).toThrow(/registry/);
    expect(() => buildrPlugin({ collections: {}, authorCode: () => true })).toThrow(/registry/);
    expect(() => buildrPlugin({ collections: {}, authorCode: false })).not.toThrow();
    expect(() => buildrPlugin({ collections: {} })).not.toThrow();
    expect(() =>
      buildrPlugin({ collections: {}, registry: { meta }, authorCode: true }),
    ).not.toThrow();
  });
});

describe('authorCodePermitted', () => {
  const req = (user?: object) => ({ user }) as never;
  const apiKey = req({ _strategy: 'api-key' });

  it('is off by default and for anything but exactly true', async () => {
    expect(resolveOptions({ collections: {} }).authorCode).toBe(false);
    const off = { authorCode: false } as const;
    expect(await authorCodePermitted(off, req({ id: 1 }))).toBe(false);
    const truthy = { authorCode: (() => 'yes') as never };
    expect(await authorCodePermitted(truthy, req({ id: 1 }))).toBe(false);
    expect(
      await authorCodePermitted({ authorCode: () => Promise.reject(new Error('x')) }, req()),
    ).toBe(false);
  });

  it('follows a boolean or a function of the request, and never grants an API key', async () => {
    expect(await authorCodePermitted({ authorCode: true }, req({ id: 1 }))).toBe(true);
    const admin = {
      authorCode: ({ req }: { req: { user?: { role?: string } | null } }) =>
        req.user?.role === 'admin',
    };
    expect(await authorCodePermitted(admin as never, req({ role: 'admin' }))).toBe(true);
    expect(await authorCodePermitted(admin as never, req({ role: 'editor' }))).toBe(false);
    expect(await authorCodePermitted(admin as never, req())).toBe(false);
    expect(await authorCodePermitted({ authorCode: true }, apiKey)).toBe(false);
    expect(await authorCodePermitted({ authorCode: async () => true }, apiKey)).toBe(false);
  });
});

describe('the layout hook and author code', () => {
  let dir: string;
  let payload: Payload;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'buildr-payload-author-'));
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
        buildrPlugin({
          collections: { pages: { context: 'page' } },
          registry: { meta },
          // Trusted only for requests that say so, as a host would decide from `req.user`.
          authorCode: ({ req }) => req.context['trusted'] === true,
        }),
      ],
      typescript: { autoGenerate: false },
    });
    payload = await getPayload({ config, key: 'author-code' });
  });
  afterAll(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows keeps the database file open a moment longer.
    }
  });

  const write = (
    payload: Payload,
    data: Record<string, unknown>,
    id?: number | string,
    trusted = false,
  ) =>
    id === undefined
      ? payload.create({ collection: 'pages', data, draft: true, context: { trusted } })
      : payload.update({
          collection: 'pages',
          id,
          data,
          draft: true,
          context: { [BUILDR_WRITE]: true, trusted },
        });
  // The message of the field error a rejected write carries ("layout" is all the top-level message says).
  const fieldError = async (write: Promise<unknown>): Promise<string> => {
    const error = (await write.then(
      () => undefined,
      (caught: unknown) => caught,
    )) as { data?: { errors?: { message: string }[] } } | undefined;
    return error?.data?.errors?.[0]?.message ?? '(the write was accepted)';
  };
  const nodeOf = async (payload: Payload, id: number | string) =>
    (
      (await payload.findByID({ collection: 'pages', id, draft: true })) as unknown as {
        layout: BuilderDocument;
      }
    ).layout.nodes['widget0001'];

  it('rejects author code on create and on update for a request the option does not allow', async () => {
    const off = payload;
    await expect(fieldError(write(off, { title: 'A', layout: withAuthor(RED) }))).resolves.toMatch(
      /author code/i,
    );
    const doc = await write(off, { title: 'B' });
    await expect(fieldError(write(off, { layout: withAuthor({}, HTML) }, doc.id))).resolves.toMatch(
      /author code/i,
    );
    expect(await nodeOf(off, doc.id)).toBeUndefined();
    // Without author code the same save goes through.
    await write(off, { layout: withAuthor({}) }, doc.id);
    expect(await nodeOf(off, doc.id)).toBeDefined();
  });

  it('resolves the option per request and keeps stored author code saveable', async () => {
    const trusting = payload;
    await expect(
      fieldError(write(trusting, { title: 'C', layout: withAuthor(RED) })),
    ).resolves.toMatch(/author code/i);
    const doc = await write(trusting, { title: 'D', layout: withAuthor(RED) }, undefined, true);
    expect((await nodeOf(trusting, doc.id))?.customCss).toBe(RED.customCss);

    // Unchanged author code is saved without the capability (an edit elsewhere in the page).
    await write(trusting, { layout: withAuthor(RED, { title: s('renamed') }) }, doc.id);
    expect((await nodeOf(trusting, doc.id))?.customCss).toBe(RED.customCss);
    // A change is not.
    await expect(
      fieldError(write(trusting, { layout: withAuthor(BLUE) }, doc.id)),
    ).resolves.toMatch(/author code/i);
    // A trusted request may change it, and anyone may remove it.
    await write(trusting, { layout: withAuthor(BLUE) }, doc.id, true);
    expect((await nodeOf(trusting, doc.id))?.customCss).toBe(BLUE.customCss);
    await write(trusting, { layout: withAuthor({}) }, doc.id);
    expect((await nodeOf(trusting, doc.id))?.customCss).toBeUndefined();
  });

  it('does not copy author code through duplicate, and does not restore it through restoreVersion', async () => {
    const source = await write(
      payload,
      { title: 'E', layout: withAuthor(RED, HTML) },
      undefined,
      true,
    );
    // A duplicate is a new document: the source's author code is not "already stored" for it.
    await expect(
      fieldError(
        payload.duplicate({
          collection: 'pages',
          id: source.id,
          draft: true,
          context: { trusted: false },
        }),
      ),
    ).resolves.toMatch(/author code/i);
    const all = await payload.find({
      collection: 'pages',
      draft: true,
      limit: 100,
      pagination: false,
    });
    expect(all.docs.filter((doc) => doc['title'] === 'E')).toHaveLength(1);
    // A trusted request may duplicate it.
    const trusted = await payload.duplicate({
      collection: 'pages',
      id: source.id,
      draft: true,
      context: { trusted: true },
    });
    expect((await nodeOf(payload, trusted.id))?.customCss).toBe(RED.customCss);

    // restoreVersion by an untrusted request keeps the stored layout (the write guard), so code
    // that a later trusted save removed does not come back.
    await write(payload, { layout: withAuthor({}) }, source.id, true);
    const versions = await payload.findVersions({
      collection: 'pages',
      where: { parent: { equals: source.id } },
      sort: 'createdAt',
      limit: 20,
    });
    const withCode = versions.docs.find(
      (version) =>
        (version.version as { layout?: BuilderDocument }).layout?.nodes['widget0001']?.customCss !==
        undefined,
    );
    expect(withCode).toBeDefined();
    await payload
      .restoreVersion({ collection: 'pages', id: String(withCode?.id), draft: true })
      .catch(() => undefined);
    expect((await nodeOf(payload, source.id))?.customCss).toBeUndefined();
  });
});
