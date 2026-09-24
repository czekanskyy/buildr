import { defineComponent } from '@buildr/react';
import { stackProps } from './props.ts';
import { StackView } from './view.tsx';

export { STACK_ROLES } from './props.ts';

/**
 * A flex container. Direction, wrap, gap and alignment are style properties (`layout.*`), so they
 * change per breakpoint; this component only sets the defaults (a column with a gap).
 */
export const Stack = defineComponent({
  type: 'buildr/stack',
  version: 1,
  label: 'Stack',
  description: 'Lays its children out in a row or a column.',
  keywords: ['flex', 'row', 'column', 'group', 'flexbox'],
  category: 'layout',
  icon: 'list',
  contentCategories: ['flow'],
  props: stackProps,
  slots: { default: { label: 'Content', axis: 'auto' } },
  styles: {
    groups: ['layout', 'size', 'spacing', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'div' },
  editor: { emptySlotText: { default: 'Drop content here' } },
  runtime: 'shared',
  render: StackView,
});
