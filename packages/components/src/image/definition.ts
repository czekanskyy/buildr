import { defineComponent } from '@buildr/react';
import { imageProps } from './props.ts';
import { ImageView } from './view.tsx';

export { IMAGE_FITS, IMAGE_SIZES } from './props.ts';

/**
 * A picture from the media library (or bound to a CMS field). It renders through the platform's
 * `Image` (`next/image` in a Next.js site, a plain `<img>` otherwise) with a `srcset` built from
 * the sizes the media library generated, and a focal point becomes `object-position`.
 */
export const Image = defineComponent({
  type: 'buildr/image',
  version: 1,
  label: 'Image',
  description: 'A picture, with alternative text.',
  keywords: ['picture', 'photo', 'media', 'img'],
  category: 'media',
  icon: 'image',
  contentCategories: ['flow', 'phrasing', 'media'],
  props: imageProps,
  styles: { groups: ['size', 'spacing', 'border', 'effects', 'visibility'] },
  a11y: { element: 'img', requiresName: true },
  editor: { placeholder: 'Choose an image' },
  runtime: 'shared',
  render: ImageView,
});
