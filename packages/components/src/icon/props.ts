import { p } from '@next-buildr/core';

export const ICON_SIZES = ['sm', 'md', 'lg', 'xl'] as const;

export const iconProps = {
  name: p.icon({ label: 'Icon', default: 'star' }),
  /** Names the icon. Without it the icon is decorative and hidden from assistive technology. */
  label: p.text({ label: 'Accessible name', localizable: true }),
  size: p.select({ label: 'Size', options: ICON_SIZES, default: 'md' }),
} as const;
