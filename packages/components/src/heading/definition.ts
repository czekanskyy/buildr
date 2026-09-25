import { defineComponent } from '@buildr/react';
import { headingProps } from './props.ts';
import { HeadingView } from './view.tsx';

export { HEADING_LEVELS } from './props.ts';

/**
 * A heading, `h1` to `h6`. The level is the outline level; size and weight are typography styles
 * (with a default per level in the component CSS), so a small `h2` and a large `h4` are both possible.
 */
export const Heading = defineComponent({
  type: 'buildr/heading',
  version: 1,
  label: 'Heading',
  description: 'A title. Its level is the outline; its look is a style.',
  keywords: ['title', 'h1', 'h2', 'headline'],
  category: 'content',
  icon: 'heading',
  contentCategories: ['flow', 'heading'],
  props: headingProps,
  styles: {
    groups: ['typography', 'spacing', 'background', 'border', 'size', 'effects', 'visibility'],
  },
  a11y: { element: 'h1-h6', requiresName: true },
  editor: { inlineProp: 'text', placeholder: 'Heading' },
  runtime: 'shared',
  render: HeadingView,
});
