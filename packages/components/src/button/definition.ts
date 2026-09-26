import { defineComponent } from '@next-buildr/react';
import { buttonProps } from './props.ts';
import { ButtonView } from './view.tsx';

export { BUTTON_SIZES, BUTTON_TYPES, BUTTON_VARIANTS, ICON_POSITIONS } from './props.ts';

/**
 * An action or a call to action. With a `href` it navigates (through the platform's link, so a
 * framework router can handle it); without one it is a `<button>` of type `button` or `submit`.
 * An icon-only button needs an accessible name.
 */
export const Button = defineComponent({
  type: 'buildr/button',
  version: 1,
  label: 'Button',
  description: 'A button, or a link that looks like one.',
  keywords: ['cta', 'call to action', 'submit', 'link'],
  category: 'content',
  icon: 'mouse-pointer-click',
  contentCategories: ['flow', 'phrasing', 'interactive'],
  props: buttonProps,
  styles: {
    groups: ['typography', 'spacing', 'background', 'border', 'size', 'effects', 'visibility'],
  },
  a11y: { element: 'button', requiresName: true },
  editor: { inlineProp: 'label', placeholder: 'Button' },
  runtime: 'shared',
  render: ButtonView,
});
