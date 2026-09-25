import { defineComponent } from '@buildr/react';
import { richTextProps } from './props.ts';
import { RichTextView } from './view.tsx';

/**
 * Formatted content: headings, paragraphs, lists, quotes, links and inline formats, from the
 * rich text value of the CMS (or written in the editor). Its typography is its own CSS, scoped to
 * the component, so it does not leak into the rest of the page.
 */
export const RichText = defineComponent({
  type: 'buildr/rich-text',
  version: 1,
  label: 'Rich text',
  description: 'Formatted content: headings, paragraphs, lists, quotes and links.',
  keywords: ['content', 'article', 'body', 'wysiwyg', 'post'],
  category: 'content',
  icon: 'pilcrow',
  contentCategories: ['flow'],
  props: richTextProps,
  styles: {
    groups: ['typography', 'spacing', 'background', 'border', 'size', 'effects', 'visibility'],
  },
  a11y: { element: 'div' },
  editor: { placeholder: 'Write something' },
  runtime: 'shared',
  render: RichTextView,
});
