// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { createMemoryDataSource, s, toManifest, validatePropValue } from '@next-buildr/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { conventionProblems } from '../conventions.test-kit.ts';
import { GalleryItem } from '../gallery-item/definition.ts';
import { Loop } from '../loop/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Gallery } from './definition.ts';
import { galleryFixtures, galleryImage, galleryMedia } from './fixtures.ts';
import { galleryProps } from './props.ts';
import { GalleryView } from './view.tsx';

const registry = createRegistry({ components: [Page, Gallery, GalleryItem, Loop] });
it.each(galleryFixtures)('snapshot and axe $id', async (fixture) => {
  expect(problemsOf(registry, fixture)).toEqual([]);
  const result = await render(
    registry,
    pageWith(fixture.tree),
    createMemoryDataSource({
      media: galleryMedia,
      collections: {
        photos: [
          {
            image: { ...galleryImage, snapshot: galleryMedia.g1 },
            alt: 'Bound landscape',
            caption: 'Bound caption',
          },
        ],
      },
    }),
  );
  const host = document.createElement('main');
  host.innerHTML = result.html;
  await expect(host.innerHTML.replace(/ b-[^" ]+/g, '')).toMatchFileSnapshot(
    `./${fixture.id}.snap`,
  );
  expect((await axe(host, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual(
    [],
  );
});
it('validates props, clamps bindings, spreads root and omits the canvas enhancer', async () => {
  expect(validatePropValue(galleryProps.columns, s(7)).ok).toBe(false);
  expect(validatePropValue(galleryProps.columns, s(1)).ok).toBe(false);
  expect(validatePropValue(galleryProps.aspectRatio, s('bad')).ok).toBe(false);
  const { html } = await render(
    registry,
    pageWith({
      type: 'buildr/gallery',
      props: {
        columns: { kind: 'binding', path: 'x.columns' },
        ariaLabel: { kind: 'binding', path: 'x.label' },
      },
    }),
    undefined,
    { x: { columns: 99, label: 'Photos' } },
  );
  expect(html).toContain('data-columns="3"');
  expect(html).toContain('aria-label="Photos"');
  const canvas = renderToStaticMarkup(
    createElement(GalleryView, {
      props: { ariaLabel: '', columns: -1, aspectRatio: 'auto', lightbox: true },
      root: { className: 'bc-gallery', 'data-probe': 'yes' },
      env: { mode: 'canvas' },
    } as never),
  );
  expect(canvas).toContain('data-probe="yes"');
  expect(canvas).toContain('data-columns="2"');
  expect(canvas).not.toContain('data-gallery-enhancer');
  expect(canvas).not.toContain('aria-label');
  const high = renderToStaticMarkup(
    createElement(GalleryView, {
      props: { ariaLabel: '', columns: 99, aspectRatio: 'auto', lightbox: false },
      root: {},
      env: { mode: 'production' },
    } as never),
  );
  expect(high).toContain('data-columns="6"');
});
it('has compact metadata and complete directories', () => {
  const manifest = toManifest(createRegistry({ components: [Gallery, GalleryItem] }).meta);
  expect(JSON.stringify(manifest).length).toBeLessThan(2100);
  expect(JSON.stringify(manifest).length).toMatchInlineSnapshot(`1875`);
  expect(JSON.stringify([Gallery.meta, GalleryItem.meta]).length).toBeLessThan(2100);
  for (const name of ['gallery', 'gallery-item']) {
    const relative = `../${name}/`;
    const dir = new URL(relative, import.meta.url);
    const files = Object.fromEntries(
      readdirSync(dir)
        .filter((f) => /\.(tsx?|css)$/.test(f))
        .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]),
    );
    expect(conventionProblems(name, files)).toEqual([]);
  }
});
