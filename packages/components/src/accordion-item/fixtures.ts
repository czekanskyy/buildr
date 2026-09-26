import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const accordionItemFixtures: readonly ComponentFixture[] = [
  {
    id: 'accordion-item-bound',
    title: 'Accordion item: a bound summary',
    tree: {
      type: 'buildr/accordion',
      children: [
        {
          type: 'buildr/accordion-item',
          props: { summary: { kind: 'binding', path: 'faq.question' } as never },
          children: [{ type: 'buildr/text', props: { text: s('The answer.') } }],
        },
      ],
    },
  },
] as const;
