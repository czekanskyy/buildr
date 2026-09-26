import { p } from '@next-buildr/core';

export const accordionProps = {
  /** Off: opening an item closes the others (the items share a `name`; older browsers ignore it). */
  allowMultiple: p.boolean({ label: 'Allow several open at once', default: true }),
} as const;
