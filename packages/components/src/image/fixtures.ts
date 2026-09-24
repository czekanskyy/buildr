import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const media = (id: string) => s({ source: 'fixtures', collection: 'media', id }) as never;

export const imageFixtures: readonly ComponentFixture[] = [
  {
    id: 'image-media',
    title: 'Image: from the media library',
    tree: { type: 'buildr/image', props: { image: media('m1') } },
  },
  {
    id: 'image-alt-override',
    title: 'Image: alternative text set by the author',
    tree: { type: 'buildr/image', props: { image: media('m1'), alt: s('A tabby cat asleep') } },
  },
  {
    id: 'image-decorative',
    title: 'Image: decorative',
    tree: { type: 'buildr/image', props: { image: media('m1'), decorative: s(true) } },
  },
  {
    id: 'image-half-width',
    title: 'Image: half width, full width on mobile',
    tree: {
      type: 'buildr/image',
      props: { image: media('m1'), sizes: s('half'), fit: s('contain') },
      styles: {
        base: { size: { width: '50%' } },
        bp: { mobile: { size: { width: '100%' } } },
      } as never,
    },
  },
] as const;

/** The media the fixtures refer to (`MemoryDataSource` input): one image with generated sizes. */
export const imageFixtureMedia = {
  m1: {
    id: 'm1',
    url: '/media/cat.jpg',
    alt: 'A cat',
    width: 1600,
    height: 900,
    mimeType: 'image/jpeg',
    focalPoint: { x: 0.25, y: 0.5 },
    sizes: {
      small: { url: '/media/cat-400.jpg', width: 400, height: 225 },
      medium: { url: '/media/cat-800.jpg', width: 800, height: 450 },
    },
  },
} as const;
