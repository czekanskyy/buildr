import { p } from '@next-buildr/core';

export const SPACER_SIZES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;
export const spacerProps = {
  size: p.select({ label: 'Size', options: SPACER_SIZES, default: 'md' }),
  axis: p.select({ label: 'Axis', options: ['vertical', 'horizontal'], default: 'vertical' }),
} as const;
