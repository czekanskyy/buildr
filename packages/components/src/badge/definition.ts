import { defineComponent } from '@buildr/react';
import { badgeProps } from './props.ts';
import { BadgeView } from './view.tsx';

export { BADGE_VARIANTS } from './props.ts';

/** A short label: a status, a count, a category. The colour is decoration; say it in the text too. */
export const Badge = defineComponent({
  type: 'buildr/badge',
  version: 1,
  label: 'Badge',
  description: 'A short status or category label.',
  keywords: ['tag', 'label', 'status', 'pill', 'chip'],
  category: 'content',
  icon: 'tag',
  contentCategories: ['flow', 'phrasing'],
  props: badgeProps,
  styles: { groups: ['typography', 'spacing', 'background', 'border', 'effects', 'visibility'] },
  a11y: { element: 'span' },
  editor: { inlineProp: 'text', placeholder: 'Badge' },
  runtime: 'shared',
  render: BadgeView,
});
