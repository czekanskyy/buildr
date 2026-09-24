import { p } from '@buildr/core';
import { defineComponent } from '@buildr/react';
import { ContainerView } from './view.tsx';

export const CONTAINER_WIDTHS = ['sm', 'md', 'lg', 'xl'] as const;

export const containerProps = {
  width: p.select({ label: 'Max width', options: CONTAINER_WIDTHS, default: 'lg' }),
} as const;

/** Centres its content in a column no wider than a `container` token. */
export const Container = defineComponent({
  type: 'buildr/container',
  version: 1,
  label: 'Container',
  description: 'Keeps its content to a readable width, centred.',
  keywords: ['width', 'column', 'centre', 'max-width'],
  category: 'layout',
  icon: 'maximize',
  contentCategories: ['flow'],
  props: containerProps,
  slots: { default: { label: 'Content', axis: 'vertical' } },
  styles: { groups: ['layout', 'spacing', 'background', 'border', 'effects', 'visibility'] },
  a11y: { element: 'div' },
  editor: { emptySlotText: { default: 'Drop content here' } },
  runtime: 'shared',
  render: ContainerView,
});
