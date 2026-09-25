import { defineComponent } from '@buildr/react';
import { containerProps } from './props.ts';
import { ContainerView } from './view.tsx';

export { CONTAINER_WIDTHS } from './props.ts';

/** Centres its content in a column no wider than a `container` token. */
export const Container = defineComponent({
  type: 'buildr/container',
  version: 1,
  label: 'Container',
  description: 'Keeps its content to a readable width, centred.',
  keywords: ['width', 'column', 'centre', 'max-width'],
  category: 'layout',
  icon: 'square-dashed',
  contentCategories: ['flow'],
  props: containerProps,
  slots: { default: { label: 'Content', axis: 'vertical' } },
  styles: { groups: ['layout', 'spacing', 'background', 'border', 'effects', 'visibility'] },
  a11y: { element: 'div' },
  editor: { emptySlotText: { default: 'Drop content here' } },
  runtime: 'shared',
  render: ContainerView,
});
