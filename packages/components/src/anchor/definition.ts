import { defineComponent } from '@next-buildr/react';
import { anchorProps } from './props.ts';
import { AnchorView } from './view.tsx';

export const Anchor = defineComponent({
  type: 'buildr/anchor',
  version: 1,
  label: 'Anchor',
  description: 'Named scroll target.',
  category: 'layout',
  icon: 'hash',
  contentCategories: ['flow'],
  props: anchorProps,
  styles: { groups: ['size', 'visibility'] },
  a11y: { element: 'span' },
  runtime: 'shared',
  render: AnchorView,
});
