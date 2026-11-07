import { defineComponent } from '@next-buildr/react';
import { galleryItemProps } from './props.ts';
import { GalleryItemView } from './view.tsx';
export const GalleryItem = defineComponent({
  type: 'buildr/gallery-item',
  version: 1,
  label: 'Gallery item',
  description: 'One linked gallery image.',
  category: 'media',
  icon: 'square',
  contentCategories: ['flow'],
  parents: { allow: ['buildr/gallery', 'buildr/loop'], requireAncestor: ['buildr/gallery'] },
  capabilities: { insertable: false },
  props: galleryItemProps,
  styles: { groups: ['spacing', 'border', 'effects', 'visibility'] },
  a11y: { element: 'div' },
  runtime: 'shared',
  render: GalleryItemView,
});
