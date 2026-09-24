import { parseDocument } from '@buildr/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { builtinLayout, resolveLayout } from '../../data/index.ts';
import { boot, type Harness, title, withChild } from './endpoints.test-kit.ts';

let h: Harness;
beforeAll(async () => {
  h = await boot(
    'templates',
    {
      collections: {
        pages: { context: 'page', templates: true },
        articles: { context: 'article', templates: true },
      },
    },
    {
      collections: [
        {
          slug: 'articles',
          admin: { useAsTitle: 'title' },
          fields: [{ name: 'title', type: 'text' }],
          versions: { drafts: true },
        },
      ],
    },
  );
});
afterAll(() => h.close());

const layout = (text: string) => withChild(title(text));

const template = (data: Record<string, unknown>, status: 'draft' | 'published' = 'published') =>
  h.payload.create({
    collection: 'buildr-templates' as never,
    data: {
      title: 'T',
      targetCollection: 'pages',
      layout: layout('T'),
      ...data,
      _status: status,
    } as never,
    draft: status === 'draft',
  });

const page = (data: Record<string, unknown> = {}) =>
  h.payload.create({
    collection: 'pages',
    data: { title: 'P', slug: 'p', ...data } as never,
    draft: true,
  });

const resolve = async (
  doc: { id: number | string },
  options: { draft?: boolean; overrideAccess?: boolean; collection?: string } = {},
) => {
  const collection = options.collection ?? 'pages';
  const stored = (await h.payload.findByID({
    collection: collection as never,
    id: doc.id,
    draft: true,
    depth: 0,
  })) as unknown as Record<string, unknown>;
  return resolveLayout({
    payload: h.payload,
    collection,
    doc: stored,
    contextName: 'page',
    ...options,
  });
};

const nameOf = (resolved: { layout: unknown }) =>
  (resolved.layout as { nodes: Record<string, { props?: { title?: { value: string } } }> }).nodes[
    'child00001'
  ]?.props?.title?.value;

describe('resolveLayout', () => {
  it('prefers the own layout, then the chosen template, then the default, then the built-in one', async () => {
    const chosen = await template({ title: 'Chosen', layout: layout('chosen') });
    const isDefault = await template({
      title: 'Default',
      isDefault: true,
      layout: layout('default'),
    });

    const own = await page({ layout: layout('own'), template: chosen.id });
    expect(await resolve(own)).toMatchObject({ source: 'document', layoutRef: `pages:${own.id}` });
    expect(nameOf(await resolve(own))).toBe('own');

    const inherits = await page({ template: chosen.id });
    const viaTemplate = await resolve(inherits);
    expect(viaTemplate).toMatchObject({
      source: 'template',
      layoutRef: `buildr-templates:${chosen.id}`,
    });
    expect(nameOf(viaTemplate)).toBe('chosen');

    const plain = await page();
    const viaDefault = await resolve(plain);
    expect(viaDefault).toMatchObject({
      source: 'default-template',
      layoutRef: `buildr-templates:${isDefault.id}`,
    });
    expect(nameOf(viaDefault)).toBe('default');

    await h.payload.delete({ collection: 'buildr-templates' as never, id: isDefault.id });
    expect(await resolve(plain)).toMatchObject({ source: 'builtin', layoutRef: null });
  });

  it('treats an empty layout as none', async () => {
    const chosen = await template({ title: 'Chosen', layout: layout('chosen') });
    const empty = await page({
      layout: {
        schemaVersion: 1,
        root: 'root',
        nodes: { root: { id: 'root', type: 'buildr/page' } },
        components: { 'buildr/page': 1 },
      },
      template: chosen.id,
    });
    expect((await resolve(empty)).source).toBe('template');
  });

  it('uses published templates only, unless it reads drafts', async () => {
    const draft = await template({ title: 'Wip', layout: layout('wip') }, 'draft');
    const doc = await page({ template: draft.id });
    expect((await resolve(doc)).source).not.toBe('template');
    expect((await resolve(doc, { draft: true })).source).not.toBe('template');
    expect(await resolve(doc, { draft: true, overrideAccess: true })).toMatchObject({
      source: 'template',
    });
  });

  it('never uses a template of another collection', async () => {
    const other = await template({
      title: 'For articles',
      targetCollection: 'articles',
      layout: layout('other'),
    });
    const doc = await page({ template: other.id });
    expect((await resolve(doc)).source).not.toBe('template');
  });

  it('answers with a built-in layout that is a valid document', () => {
    const parsed = parseDocument(builtinLayout('post'));
    expect(parsed.ok).toBe(true);
    expect(JSON.stringify(builtinLayout('post'))).toContain('post.title');
  });
});

describe('buildr-templates', () => {
  it('allows one default per target collection', async () => {
    const first = await template({ title: 'First', targetCollection: 'articles', isDefault: true });
    await expect(
      template({ title: 'Second', targetCollection: 'articles', isDefault: true }),
    ).rejects.toThrow();
    // Another collection may have its own default, and the default may be saved again.
    await template({ title: 'Pages default', targetCollection: 'pages', isDefault: true });
    await h.payload.update({
      collection: 'buildr-templates' as never,
      id: first.id,
      data: { title: 'First, renamed' } as never,
    });
    // Unmarking the first makes room for another.
    await h.payload.update({
      collection: 'buildr-templates' as never,
      id: first.id,
      data: { isDefault: false } as never,
    });
    const second = await template({
      title: 'Second',
      targetCollection: 'articles',
      isDefault: true,
    });
    expect(second.id).toBeDefined();
  });

  it('rejects an invalid layout and a target that takes no templates', async () => {
    await expect(template({ layout: { nope: true } })).rejects.toThrow();
    await expect(template({ targetCollection: 'users' })).rejects.toThrow();
  });

  it('is readable by visitors only when published, and writable only by the builder', async () => {
    const live = await template({ title: 'Live' });
    const wip = await template({ title: 'Wip' }, 'draft');
    const visible = await h.payload.find({
      collection: 'buildr-templates' as never,
      overrideAccess: false,
    });
    const ids = visible.docs.map((doc) => (doc as { id: unknown }).id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(wip.id);
    await expect(
      h.payload.create({
        collection: 'buildr-templates' as never,
        data: { title: 'x', targetCollection: 'pages' } as never,
        overrideAccess: false,
      }),
    ).rejects.toThrow();
  });
});

describe('GET /buildr/documents: the source of the layout', () => {
  it('opens an inheriting document with the template, and says where it came from', async () => {
    const chosen = await template({ title: 'Shared', layout: layout('shared') });
    const doc = await page({ template: chosen.id });
    const { status, body } = await h.call('GET', `/buildr/documents/pages/${doc.id}`);
    expect(status).toBe(200);
    expect(body.layoutSource).toBe('template');
    expect(body.layoutRef).toBe(`buildr-templates:${chosen.id}`);
    expect(nameOf({ layout: body.document })).toBe('shared');
  });

  it('opens an own layout as such, and a bare document blank with the built-in source', async () => {
    const own = await page({ layout: layout('mine') });
    const opened = await h.call('GET', `/buildr/documents/pages/${own.id}`);
    expect(opened.body).toMatchObject({ layoutSource: 'document', layoutRef: `pages:${own.id}` });

    await h.payload.delete({
      collection: 'buildr-templates' as never,
      where: { isDefault: { equals: true } },
    });
    const bare = await page();
    const blank = await h.call('GET', `/buildr/documents/pages/${bare.id}`);
    expect(blank.body).toMatchObject({ layoutSource: 'builtin', layoutRef: null });
    expect(Object.keys(blank.body.document.nodes)).toEqual(['root']);
  });
});
