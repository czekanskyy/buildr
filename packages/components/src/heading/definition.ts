import { defineComponent } from '@next-buildr/react';
import { headingProps } from './props.ts';
import { HeadingView } from './view.tsx';

export { HEADING_LEVELS, HEADING_TAGS } from './props.ts';

/**
 * A heading, `h1` to `h6`, or (with `tag`) the same text as a `p`, `span`, `div` or `strong` outside the outline. The level is the outline level; size and weight are typography styles
 * (with a default per level in the component CSS), so a small `h2` and a large `h4` are both possible.
 */
export const Heading = defineComponent({
  type: 'buildr/heading',
  version: 2,
  label: 'Heading',
  description: 'A title. Its level is the outline; its look is a style.',
  keywords: ['title', 'h1', 'h2', 'headline'],
  category: 'content',
  icon: 'heading',
  contentCategories: ['flow', 'heading'],
  props: headingProps,
  styles: {
    groups: [
      'typography',
      'spacing',
      'background',
      'border',
      'size',
      'effects',
      'motion',
      'visibility',
    ],
  },
  a11y: { element: 'h1-h6', requiresName: true },
  editor: { inlineProp: 'text', placeholder: 'Heading' },
  runtime: 'shared',
  // Version 2 added the optional `tag` (default `heading`, the old rendering). A stored heading has
  // no `tag`, which already means `heading`, so its props do not change.
  migrations: { 2: (props) => props },
  render: HeadingView,
});
