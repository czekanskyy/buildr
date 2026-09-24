import { p } from '@buildr/core';

export const BUTTON_VARIANTS = ['primary', 'secondary', 'outline', 'ghost'] as const;
export const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
export const BUTTON_TYPES = ['button', 'submit'] as const;
export const ICON_POSITIONS = ['start', 'end'] as const;

export const buttonProps = {
  label: p.text({ label: 'Label', default: 'Button', bindable: true }),
  /** With a destination it is a link that looks like a button; without one, a real `<button>`. */
  href: p.link({ label: 'Link', bindable: true }),
  type: p.select({ label: 'Type', options: BUTTON_TYPES, default: 'button' }),
  variant: p.select({ label: 'Variant', options: BUTTON_VARIANTS, default: 'primary' }),
  size: p.select({ label: 'Size', options: BUTTON_SIZES, default: 'md' }),
  icon: p.icon({ label: 'Icon' }),
  iconPosition: p.select({ label: 'Icon position', options: ICON_POSITIONS, default: 'start' }),
  ariaLabel: p.text({ label: 'Accessible name', localizable: true }),
  newTab: p.boolean({ label: 'Open in a new tab', default: false }),
} as const;
