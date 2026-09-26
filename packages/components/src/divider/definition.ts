import { defineComponent } from '@next-buildr/react';
import { dividerProps } from './props.ts';
import { DividerView } from './view.tsx';

/** A thematic break: an `<hr>`. */
export const Divider = defineComponent({
  type: 'buildr/divider',
  version: 1,
  label: 'Divider',
  description: 'A horizontal rule.',
  keywords: ['hr', 'rule', 'separator', 'line'],
  category: 'content',
  icon: 'separator-horizontal',
  contentCategories: ['flow'],
  props: dividerProps,
  styles: { groups: ['size', 'spacing', 'border', 'effects', 'visibility'] },
  a11y: { element: 'hr' },
  runtime: 'shared',
  render: DividerView,
});
