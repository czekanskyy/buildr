import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const item = (summary: string, answer: string, open = false) => ({
  type: 'buildr/accordion-item',
  props: { summary: s(summary), defaultOpen: s(open) },
  children: [{ type: 'buildr/text', props: { text: s(answer) } }],
});

export const accordionFixtures: readonly ComponentFixture[] = [
  {
    id: 'accordion-faq',
    title: 'Accordion: a FAQ, the first item open',
    tree: {
      type: 'buildr/accordion',
      children: [
        item('What is Buildr?', 'A page builder.', true),
        item('Does it need JavaScript?', 'No: it is built on details.'),
        item('Can I bind the text?', 'Yes, to any field.'),
      ],
    },
  },
  {
    id: 'accordion-exclusive',
    title: 'Accordion: one item open at a time',
    tree: {
      type: 'buildr/accordion',
      props: { allowMultiple: s(false) },
      children: [item('First', 'One.', true), item('Second', 'Two.'), item('Third', 'Three.')],
    },
  },
] as const;
