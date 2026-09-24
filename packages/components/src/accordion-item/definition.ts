import { defineComponent } from '@buildr/react';
import { accordionItemProps } from './props.ts';
import { AccordionItemView } from './view.tsx';

/** One expandable section: a summary that is always visible and content that opens under it. */
export const AccordionItem = defineComponent({
  type: 'buildr/accordion-item',
  version: 1,
  label: 'Accordion item',
  description: 'One section of an accordion.',
  category: 'ui',
  icon: 'chevron-down',
  contentCategories: ['flow'],
  parents: { allow: ['buildr/accordion', 'buildr/loop'] },
  props: accordionItemProps,
  slots: { default: { label: 'Content', allow: ['#flow'], axis: 'vertical' } },
  capabilities: { insertable: false },
  styles: { groups: ['spacing', 'background', 'border', 'typography', 'effects', 'visibility'] },
  a11y: { element: 'details', requiresName: true },
  editor: {
    inlineProp: 'summary',
    placeholder: 'Question',
    revealOnSelect: true,
    emptySlotText: { default: 'Add the answer' },
  },
  runtime: 'shared',
  render: AccordionItemView,
});
