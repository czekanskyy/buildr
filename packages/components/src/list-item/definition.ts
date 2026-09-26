import { defineComponent } from '@next-buildr/react';
import { listItemProps } from './props.ts';
import { ListItemView } from './view.tsx';

/** One item of a List: some text and, optionally, more content (a nested list, say) after it. */
export const ListItem = defineComponent({
  type: 'buildr/list-item',
  version: 1,
  label: 'List item',
  description: 'One entry of a list.',
  category: 'content',
  icon: 'dot',
  contentCategories: ['list-item'],
  parents: { allow: ['buildr/list', 'buildr/loop'] },
  props: listItemProps,
  slots: { default: { label: 'More content', allow: ['#flow'], axis: 'vertical' } },
  capabilities: { insertable: false },
  styles: { groups: ['typography', 'spacing', 'background', 'border', 'effects', 'visibility'] },
  a11y: { element: 'li' },
  editor: { inlineProp: 'text', placeholder: 'Item' },
  runtime: 'shared',
  render: ListItemView,
});
