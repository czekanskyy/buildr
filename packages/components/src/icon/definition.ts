import { defineComponent } from '@buildr/react';
import { iconProps } from './props.ts';
import { IconView } from './view.tsx';

export { ICON_SIZES } from './props.ts';

/** A stroked icon from the built-in set. Decorative unless it has a label. Drawn on the server, no JavaScript. */
export const IconComponent = defineComponent({
  type: 'buildr/icon',
  version: 1,
  label: 'Icon',
  description: 'A small pictogram.',
  keywords: ['symbol', 'pictogram', 'svg'],
  category: 'media',
  icon: 'sparkles',
  contentCategories: ['flow', 'phrasing', 'media'],
  props: iconProps,
  styles: { groups: ['size', 'spacing', 'typography', 'effects', 'visibility'] },
  a11y: { element: 'svg' },
  runtime: 'shared',
  render: IconView,
});
