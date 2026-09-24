import { p } from '@buildr/core';

export const listProps = {
  ordered: p.boolean({ label: 'Numbered', default: false }),
  ariaLabel: p.text({ label: 'Accessible name', localizable: true }),
} as const;
