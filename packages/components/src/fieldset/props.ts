import { p } from '@next-buildr/core';
export const fieldsetProps = {
  legend: p.text({ label: 'Legend', default: '', localizable: true }),
  disabled: p.boolean({ label: 'Disabled', default: false }),
} as const;
