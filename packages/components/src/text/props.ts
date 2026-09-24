import { p } from '@buildr/core';

/** `p` for a paragraph; `span`, `small` and `div` when a paragraph is not the right meaning. */
export const TEXT_ELEMENTS = ['p', 'span', 'small', 'div'] as const;

export const textProps = {
  text: p.textarea({ label: 'Text', default: '', bindable: true }),
  as: p.select({ label: 'Element', options: TEXT_ELEMENTS, default: 'p' }),
} as const;
