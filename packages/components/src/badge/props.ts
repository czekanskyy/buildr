import { p } from '@next-buildr/core';

export const BADGE_VARIANTS = ['neutral', 'primary', 'success', 'warning', 'danger'] as const;

export const badgeProps = {
  text: p.text({ label: 'Text', default: 'Badge', bindable: true }),
  variant: p.select({ label: 'Variant', options: BADGE_VARIANTS, default: 'neutral' }),
} as const;
