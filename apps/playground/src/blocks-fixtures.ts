import { type GalleryEntry, galleryEntries } from '@next-buildr/components';
import { registryVersions, s } from '@next-buildr/core';
import { doc } from '@next-buildr/test-utils';
import { registry } from './registry.ts';

const carousel = galleryEntries.find((entry) => entry.id === 'carousel-default');
const gallery = galleryEntries.find((entry) => entry.id === 'gallery-default');
if (!carousel || !gallery) throw new Error('Missing block fixtures');
const extras: GalleryEntry[] = [
  {
    ...carousel,
    id: 'carousel-input',
    tree: {
      type: 'buildr/form',
      children: [
        {
          ...carousel.tree,
          children: [
            {
              type: 'buildr/carousel-slide',
              children: [
                {
                  type: 'buildr/input',
                  props: { label: s('Slide input'), name: s('slide-input') },
                },
              ],
            },
            ...(carousel.tree.children ?? []),
          ],
        },
      ],
    },
  },
  {
    ...gallery,
    id: 'gallery-four',
    tree: {
      ...gallery.tree,
      children: [
        ...(gallery.tree.children ?? []),
        {
          type: 'buildr/gallery-item',
          props: {
            image: s({ source: 'fixtures', collection: 'media', id: 'g1' }) as never,
            caption: s('Landscape 4'),
          },
        },
      ],
    },
  },
  {
    ...gallery,
    id: 'gallery-two',
    tree: { type: 'buildr/container', children: [gallery.tree, gallery.tree] },
  },
];

export const blockEntries = [...galleryEntries, ...extras].map((entry) => ({
  ...entry,
  document: doc(
    { type: 'buildr/page', children: [entry.tree as never] },
    { versions: registryVersions(registry.meta) },
  ),
}));
