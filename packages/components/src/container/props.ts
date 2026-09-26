import { p } from '@next-buildr/core';

export const CONTAINER_WIDTHS = ['sm', 'md', 'lg', 'xl'] as const;

export const containerProps = {
  width: p.select({ label: 'Max width', options: CONTAINER_WIDTHS, default: 'lg' }),
} as const;
