import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';
export const galleryImage = { source: 'fixtures', collection: 'media', id: 'g1' };
export const galleryMedia = {
  g1: {
    id: 'g1',
    url: '/media/gallery.svg',
    mimeType: 'image/svg+xml',
    alt: 'Landscape',
    width: 800,
    height: 600,
  },
};
const items = [1, 2, 3].map((n) => ({
  type: 'buildr/gallery-item',
  props: { image: s(galleryImage) as never, caption: s(`Landscape ${n}`) },
}));
export const galleryFixtures: readonly ComponentFixture[] = [
  { id: 'gallery-default', title: 'Gallery', tree: { type: 'buildr/gallery', children: items } },
  {
    id: 'gallery-wide',
    title: 'Wide gallery',
    tree: {
      type: 'buildr/gallery',
      props: { columns: s(4), aspectRatio: s('16:9') },
      children: items,
    },
  },
  {
    id: 'gallery-auto',
    title: 'Natural gallery',
    tree: { type: 'buildr/gallery', props: { aspectRatio: s('auto') }, children: items },
  },
  {
    id: 'gallery-links',
    title: 'Links only',
    tree: { type: 'buildr/gallery', props: { lightbox: s(false) }, children: items },
  },
  {
    id: 'gallery-empty',
    title: 'Empty gallery items',
    tree: {
      type: 'buildr/gallery',
      children: [1, 2, 3].map(() => ({ type: 'buildr/gallery-item' })),
    },
  },
  {
    id: 'gallery-loop',
    title: 'Collection gallery',
    tree: {
      type: 'buildr/gallery',
      children: [
        {
          type: 'buildr/loop',
          props: { source: s({ type: 'query', spec: { source: 'photos', limit: 10 } }) as never },
          slots: {
            item: [
              {
                type: 'buildr/gallery-item',
                props: {
                  image: { kind: 'binding', path: 'item.image' } as never,
                  alt: { kind: 'binding', path: 'item.alt' } as never,
                  caption: { kind: 'binding', path: 'item.caption' } as never,
                },
              },
            ],
          },
        },
      ],
    },
  },
];
