import { p } from '@next-buildr/core';

export const listItemProps = {
  text: p.text({ label: 'Text', default: 'Item', bindable: true }),
} as const;
