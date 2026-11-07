import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const carouselFixtures: readonly ComponentFixture[] = [
  {
    id: 'carousel-default',
    title: 'Carousel: arrows, dots and keyboard navigation',
    tree: {
      type: 'buildr/carousel',
      children: [1, 2, 3].map((n) => ({
        type: 'buildr/carousel-slide',
        children: [{ type: 'buildr/text', props: { text: s(`Slide ${n}`) } }],
      })),
    },
  },
  {
    id: 'carousel-autoplay',
    title: 'Carousel: rotation with pause and wrap',
    tree: {
      type: 'buildr/carousel',
      props: { autoplay: s(true), loop: s(true), slidesPerView: s(2), interval: s(3000) },
      children: [1, 2, 3, 4].map((n) => ({
        type: 'buildr/carousel-slide',
        children: [{ type: 'buildr/text', props: { text: s(`Slide ${n}`) } }],
      })),
    },
  },
  {
    id: 'carousel-bound',
    title: 'Carousel: bound settings',
    tree: {
      type: 'buildr/carousel',
      props: Object.fromEntries(
        [
          'ariaLabel',
          'showArrows',
          'showDots',
          'loop',
          'autoplay',
          'interval',
          'slidesPerView',
        ].map((key) => [key, { kind: 'binding', path: `carousel.${key}` }]),
      ) as never,
      children: [{ type: 'buildr/carousel-slide' }, { type: 'buildr/carousel-slide' }],
    },
  },
  {
    id: 'carousel-loop',
    title: 'Carousel: memory collection',
    tree: {
      type: 'buildr/carousel',
      children: [
        {
          type: 'buildr/loop',
          props: { source: s({ type: 'query', spec: { source: 'slides', limit: 10 } }) as never },
          slots: {
            item: [
              {
                type: 'buildr/carousel-slide',
                children: [
                  {
                    type: 'buildr/text',
                    props: { text: { kind: 'binding', path: 'item.title' } as never },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  },
];
