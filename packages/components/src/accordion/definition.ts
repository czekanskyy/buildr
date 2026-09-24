import { defineComponent } from '@buildr/react';
import { accordionProps } from './props.ts';
import { AccordionView } from './view.tsx';

/** A group of items that each open and close. Built on `<details>`, so it works without JavaScript. */
export const Accordion = defineComponent({
  type: 'buildr/accordion',
  version: 1,
  label: 'Accordion',
  description: 'Expandable sections, such as a list of questions and answers.',
  keywords: ['faq', 'collapse', 'details', 'expand', 'toggle'],
  category: 'ui',
  icon: 'chevrons-up-down',
  contentCategories: ['flow'],
  props: accordionProps,
  slots: {
    default: {
      label: 'Items',
      allow: ['buildr/accordion-item', 'buildr/loop'],
      axis: 'vertical',
    },
  },
  defaults: {
    slots: {
      default: [1, 2, 3].map((n) => ({
        type: 'buildr/accordion-item',
        props: { summary: { kind: 'static' as const, value: `Question ${n}` } },
      })),
    },
  },
  styles: {
    groups: ['layout', 'size', 'spacing', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'div' },
  editor: { emptySlotText: { default: 'Add an item' } },
  runtime: 'shared',
  render: AccordionView,
});
