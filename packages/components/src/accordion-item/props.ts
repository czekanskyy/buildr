import { p } from '@next-buildr/core';

export const accordionItemProps = {
  summary: p.text({ label: 'Summary', default: 'Question', bindable: true }),
  defaultOpen: p.boolean({ label: 'Open at first', default: false }),
} as const;
