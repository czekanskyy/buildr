import { defineComponent } from '@next-buildr/react';
import { textProps } from './props.ts';
import { TextView } from './view.tsx';

export { TEXT_ELEMENTS, TEXT_MODES } from './props.ts';

/**
 * Text. Which element it is (`p`, `span`, `small`, `div`) is a semantic choice; size, weight and
 * colour are typography styles. Inside a parent that only takes phrasing content (a button, a link)
 * use `span`. `mode` picks how it is written: plain text (default), rich text, or, for trusted
 * editors on a host that allows author code, sanitised HTML (ADR-026).
 */
export const Text = defineComponent({
  type: 'buildr/text',
  version: 2,
  label: 'Text',
  description: 'A paragraph or a short piece of text.',
  keywords: ['paragraph', 'copy', 'body', 'span', 'rich text', 'html'],
  category: 'content',
  icon: 'type',
  contentCategories: ['flow', 'phrasing'],
  props: textProps,
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
  a11y: { element: 'p' },
  editor: { inlineProp: 'text', placeholder: 'Write something' },
  runtime: 'shared',
  // Version 2 added `mode` (default `plain`), `rich` and `html`. A stored text has none of them,
  // which already means plain text from `text`, so its props do not change (ADR-014).
  migrations: { 2: (props) => props },
  render: TextView,
});
