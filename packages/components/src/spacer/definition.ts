import { defineComponent } from '@next-buildr/react';
import { spacerProps } from './props.ts';
import { SpacerView } from './view.tsx';

export const Spacer = defineComponent({
  type: 'buildr/spacer',
  version: 1,
  label: 'Spacer',
  description: 'Theme spacing.',
  category: 'layout',
  icon: 'space',
  contentCategories: ['flow'],
  props: spacerProps,
  styles: { groups: ['size', 'visibility'] },
  a11y: { element: 'div' },
  runtime: 'shared',
  render: SpacerView,
});
