import { defineComponent } from '@next-buildr/react';
import { carouselSlideProps } from './props.ts';
import { CarouselSlideView } from './view.tsx';

export const CarouselSlide = defineComponent({
  type: 'buildr/carousel-slide',
  version: 1,
  label: 'Carousel slide',
  description: 'One slide in a carousel.',
  category: 'media',
  icon: 'rectangle-horizontal',
  contentCategories: ['flow'],
  parents: { allow: ['buildr/carousel', 'buildr/loop'], requireAncestor: ['buildr/carousel'] },
  capabilities: { insertable: false },
  props: carouselSlideProps,
  slots: { default: { label: 'Content', allow: ['#flow'], axis: 'vertical' } },
  styles: { groups: ['layout', 'spacing', 'background', 'border', 'visibility'] },
  a11y: { element: 'div' },
  runtime: 'shared',
  render: CarouselSlideView,
});
