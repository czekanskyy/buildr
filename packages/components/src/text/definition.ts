import { defineComponent } from '@next-buildr/react';
import { textProps } from './props.ts';
import { TextView } from './view.tsx';

export { TEXT_ELEMENTS } from './props.ts';

/**
 * Plain text. Which element it is (`p`, `span`, `small`, `div`) is a semantic choice; size,
 * weight and colour are typography styles. Inside a parent that only takes phrasing content
 * (a button, a link) use `span`.
 */
export const Text = defineComponent({
  type: 'buildr/text',
  version: 1,
  label: 'Text',
  description: 'A paragraph or a short piece of text.',
  keywords: ['paragraph', 'copy', 'body', 'span'],
  category: 'content',
  icon: 'type',
  contentCategories: ['flow', 'phrasing'],
  props: textProps,
  styles: {
    groups: ['typography', 'spacing', 'background', 'border', 'size', 'effects', 'visibility'],
  },
  a11y: { element: 'p' },
  editor: { inlineProp: 'text', placeholder: 'Write something' },
  runtime: 'shared',
  render: TextView,
});
