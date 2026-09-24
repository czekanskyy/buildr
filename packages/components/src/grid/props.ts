import { p } from '@buildr/core';

export const gridProps = {
  ariaLabel: p.text({ label: 'Accessible name', localizable: true }),
} as const;
