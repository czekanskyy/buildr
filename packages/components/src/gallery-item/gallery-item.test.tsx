// @vitest-environment jsdom
import {
  canInsert,
  canMove,
  createIndex,
  createMemoryDataSource,
  extractFragment,
  fromTree,
  registryVersions,
  s,
} from '@next-buildr/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Gallery } from '../gallery/definition.ts';
import { galleryFixtures, galleryImage, galleryMedia } from '../gallery/fixtures.ts';
import { Loop } from '../loop/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, render } from '../test-kit.tsx';
import { GalleryItem } from './definition.ts';
import { GalleryItemView } from './view.tsx';

const registry = createRegistry({ components: [Page, Gallery, GalleryItem, Loop] });
it('spreads the root and uses a localized accessible name without alt or caption', () => {
  const html = renderToStaticMarkup(
    createElement(GalleryItemView, {
      props: { image: { url: '/image.png' }, alt: '', caption: '' },
      root: { className: 'bc-gallery-item', 'data-probe': 'yes' },
      env: { locale: 'en', messages: {} },
    } as never),
  );
  expect(html).toContain('data-probe="yes"');
  expect(html).toContain('aria-label="Open image"');
  expect(html).not.toContain('figcaption');
});
it('renders external media safely, names empty-alt links and leaves empty items unlinked', async () => {
  const { html } = await render(
    registry,
    pageWith({
      type: 'buildr/gallery',
      children: [
        {
          type: 'buildr/gallery-item',
          props: {
            image: s({ external: true, url: 'https://example.com/a.jpg' }) as never,
            caption: s('Caption'),
          },
        },
        { type: 'buildr/gallery-item' },
      ],
    }),
  );
  expect(html).toContain('rel="noreferrer"');
  expect(html).toContain('referrerPolicy="no-referrer"');
  expect(html).toContain('aria-label="Caption"');
  expect(html.match(/<img/g)).toHaveLength(1);
});
it.each([true, false])('Loop-bound media snapshot=%s', async (snapshot) => {
  const fixture = galleryFixtures.find((f) => f.id === 'gallery-loop');
  if (!fixture) throw new Error('missing fixture');
  const { html, diagnostics } = await render(
    registry,
    pageWith(fixture.tree),
    createMemoryDataSource({
      media: galleryMedia,
      collections: {
        photos: [
          {
            image: { ...galleryImage, ...(snapshot ? { snapshot: galleryMedia.g1 } : {}) },
            alt: 'Bound alt',
            caption: 'Bound caption',
          },
        ],
      },
    }),
  );
  expect(html.includes('<img')).toBe(snapshot);
  expect(diagnostics.map((d) => d.code)).toContain(
    snapshot ? 'render.media-snapshot' : 'render.media-missing',
  );
  if (snapshot) {
    expect(html).toContain('alt="Bound alt"');
    expect(html).toContain('Bound caption');
  }
});
it('records the current rejection of moving an uninsertable item into a Loop', () => {
  const doc = pageWith({
    type: 'buildr/gallery',
    children: [{ type: 'buildr/gallery-item' }, { type: 'buildr/loop' }],
  });
  const item = Object.values(doc.nodes).find((n) => n.type === 'buildr/gallery-item');
  const loop = Object.values(doc.nodes).find((n) => n.type === 'buildr/loop');
  if (!item || !loop) throw new Error('missing nodes');
  const parent = Object.values(doc.nodes).find((n) => n.type === 'buildr/gallery');
  if (!parent) throw new Error('missing gallery');
  // Programmatic insertion observes the same insertable capability as palette insertion.
  expect(
    canInsert(
      doc,
      createIndex(doc),
      registry.meta,
      { parentId: parent.id, slot: 'default' },
      extractFragment(doc, [item.id]),
    ),
  ).toMatchObject({ ok: false, error: { code: 'not-insertable' } });
  expect(
    canMove(doc, createIndex(doc), registry.meta, item.id, { parentId: loop.id, slot: 'item' }),
  ).toMatchObject({ ok: false, error: { code: 'not-insertable' } });
});
it('instantiates three default gallery items through the registry like palette insertion', () => {
  const meta = registry.meta.get('buildr/gallery');
  if (!meta) throw new Error('missing gallery');
  const fragment = fromTree(
    { type: meta.type, ...(meta.defaults?.slots ? { slots: meta.defaults.slots } : {}) },
    undefined,
    registryVersions(registry.meta),
  );
  const gallery = Object.values(fragment.nodes).find((node) => node.type === 'buildr/gallery');
  if (!gallery) throw new Error('missing gallery node');
  // biome-ignore lint/complexity/useLiteralKeys: Index signature access is required by TypeScript.
  const children = gallery.slots?.['default'] ?? [];
  expect(children).toHaveLength(3);
  expect(children.map((id) => fragment.nodes[id]?.type)).toEqual([
    'buildr/gallery-item',
    'buildr/gallery-item',
    'buildr/gallery-item',
  ]);
});
