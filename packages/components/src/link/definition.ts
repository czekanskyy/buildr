import { defineComponent } from '@buildr/react';
import { linkProps } from './props.ts';
import { LinkView } from './view.tsx';

/**
 * A text link. It always navigates (through the platform's link); use Button for an action. A
 * link that opens a new tab says so to assistive technology and cannot reach back to the opener.
 */
export const Link = defineComponent({
  type: 'buildr/link',
  version: 1,
  label: 'Link',
  description: 'A text link.',
  keywords: ['anchor', 'href', 'url', 'navigation'],
  category: 'content',
  icon: 'link',
  contentCategories: ['flow', 'phrasing', 'interactive'],
  props: linkProps,
  styles: { groups: ['typography', 'spacing', 'background', 'border', 'effects', 'visibility'] },
  a11y: { element: 'a', requiresName: true },
  editor: { inlineProp: 'label', placeholder: 'Link' },
  runtime: 'shared',
  render: LinkView,
});
