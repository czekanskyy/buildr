import { defineComponent } from '@next-buildr/react';
import { galleryProps } from './props.ts';
import { GalleryView } from './view.tsx';
export const Gallery = defineComponent({
  type: 'buildr/gallery',
  version: 1,
  label: 'Gallery',
  description: 'Image grid with a lightbox.',
  category: 'media',
  icon: 'images',
  contentCategories: ['flow'],
  props: galleryProps,
  slots: { default: { allow: ['buildr/gallery-item', 'buildr/loop'], axis: 'auto' } },
  defaults: { slots: { default: [1, 2, 3].map(() => ({ type: 'buildr/gallery-item' })) } },
  styles: { groups: ['size', 'spacing', 'background', 'border', 'effects', 'visibility'] },
  a11y: { element: 'div' },
  runtime: 'shared',
  render: GalleryView,
});
