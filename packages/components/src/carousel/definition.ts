import { defineComponent } from '@next-buildr/react';
import { carouselProps } from './props.ts';
import { CarouselView } from './view.tsx';

export const Carousel = defineComponent({
  type: 'buildr/carousel',
  version: 1,
  label: 'Carousel',
  description: 'Scrollable slides with optional rotation.',
  keywords: ['slides', 'slider', 'rotation'],
  category: 'media',
  icon: 'gallery-horizontal',
  contentCategories: ['flow'],
  props: carouselProps,
  slots: {
    default: {
      label: 'Slides',
      allow: ['buildr/carousel-slide', 'buildr/loop'],
      axis: 'horizontal',
    },
  },
  defaults: { slots: { default: [1, 2, 3].map(() => ({ type: 'buildr/carousel-slide' })) } },
  styles: { groups: ['size', 'spacing', 'background', 'border', 'effects', 'visibility'] },
  a11y: { element: 'section' },
  runtime: 'shared',
  render: CarouselView,
});
