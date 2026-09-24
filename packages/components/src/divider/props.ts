import { p } from '@buildr/core';

export const dividerProps = {
  /** A rule that is only visual: hidden from assistive technology. */
  decorative: p.boolean({ label: 'Decorative', default: false }),
} as const;
