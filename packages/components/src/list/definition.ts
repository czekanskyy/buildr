import { defineComponent } from '@buildr/react';
import { listProps } from './props.ts';
import { ListView } from './view.tsx';

/** A bulleted or numbered list. It takes list items (or a Loop that produces them), nothing else. */
export const List = defineComponent({
  type: 'buildr/list',
  version: 1,
  label: 'List',
  description: 'A bulleted or numbered list.',
  keywords: ['bullets', 'ul', 'ol', 'items'],
  category: 'content',
  icon: 'list',
  contentCategories: ['flow'],
  props: listProps,
  slots: {
    default: { label: 'Items', allow: ['#list-item', 'buildr/loop'], axis: 'vertical' },
  },
  defaults: {
    slots: {
      default: [1, 2, 3].map((n) => ({
        type: 'buildr/list-item',
        props: { text: { kind: 'static' as const, value: `Item ${n}` } },
      })),
    },
  },
  styles: {
    groups: ['typography', 'spacing', 'background', 'border', 'size', 'effects', 'visibility'],
  },
  a11y: { element: 'ul' },
  editor: { emptySlotText: { default: 'Add a list item' } },
  runtime: 'shared',
  render: ListView,
});
