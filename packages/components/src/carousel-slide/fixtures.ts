import type { ComponentFixture } from '../fixtures.ts';
export const carouselSlideFixtures: readonly ComponentFixture[] = [
  {
    id: 'carousel-slide-content',
    title: 'Carousel slide: flow content',
    tree: {
      type: 'buildr/carousel',
      children: [{ type: 'buildr/carousel-slide', children: [{ type: 'buildr/text' }] }],
    },
  },
];
