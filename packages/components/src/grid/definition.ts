import { defineComponent } from '@buildr/react';
import { gridProps } from './props.ts';
import { GridView } from './view.tsx';

/**
 * A grid container. Columns come from the `layout.columns` style (per breakpoint) and a child's
 * width from its own `layout.columnSpan`; without them it fills the row with columns at least 16rem wide.
 */
export const Grid = defineComponent({
  type: 'buildr/grid',
  version: 1,
  label: 'Grid',
  description: 'Lays its children out in columns.',
  keywords: ['columns', 'layout', 'css grid', 'responsive'],
  category: 'layout',
  icon: 'layout-grid',
  contentCategories: ['flow'],
  props: gridProps,
  slots: { default: { label: 'Cells', axis: 'auto' } },
  styles: {
    groups: ['layout', 'size', 'spacing', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'div' },
  editor: { emptySlotText: { default: 'Drop content here' } },
  runtime: 'shared',
  render: GridView,
});
