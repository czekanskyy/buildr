import { defineComponent } from '@next-buildr/react';
import { loopProps } from './props.ts';
import { LoopView } from './view.tsx';

/**
 * Repeats its `item` template once per entry of a list. Inside the template `item` is the entry,
 * `index` its position and `loop` the list (`loop.page`, `loop.totalPages`, `loop.total`).
 * `empty` shows when the list has no entries; `after` shows once, below the entries (a pagination,
 * say). Layout is the Loop's own styles: make it a grid or a stack.
 */
export const Loop = defineComponent({
  type: 'buildr/loop',
  version: 1,
  label: 'Loop',
  description: 'Repeats a template for every entry of a list or a collection.',
  keywords: ['repeat', 'list', 'collection', 'query', 'cms', 'each'],
  category: 'cms',
  icon: 'repeat',
  contentCategories: ['flow'],
  props: loopProps,
  slots: {
    item: { label: 'Item template', axis: 'vertical' },
    empty: { label: 'When empty', axis: 'vertical' },
    after: { label: 'After the items', axis: 'vertical' },
  },
  styles: {
    groups: ['layout', 'size', 'spacing', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'div' },
  editor: {
    emptySlotText: {
      item: 'Design one item: it is repeated for every entry',
      empty: 'What to show when there is nothing to list',
      after: 'Add a pagination, for example',
    },
  },
  runtime: 'shared',
  render: LoopView,
});
