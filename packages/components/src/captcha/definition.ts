import { defineComponent } from '@next-buildr/react';
import { captchaProps } from './props.ts';
import { CaptchaView } from './view.tsx';

export const Captcha = defineComponent({
  type: 'buildr/captcha',
  version: 1,
  label: 'Captcha',
  description: 'Form verification.',
  category: 'forms',
  icon: 'shield-check',
  contentCategories: ['flow'],
  parents: { requireAncestor: ['buildr/form'], deny: ['buildr/loop'] },
  props: captchaProps,
  styles: { groups: ['spacing'] },
  a11y: { element: 'div' },
  runtime: 'shared',
  render: CaptchaView,
});
