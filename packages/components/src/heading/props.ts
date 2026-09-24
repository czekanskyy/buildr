import { p } from '@buildr/core';

export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export const headingProps = {
  text: p.text({ label: 'Text', default: 'Heading', bindable: true }),
  /** The document outline level. How big it looks is a style, not the level. */
  level: p.select({ label: 'Level', options: HEADING_LEVELS, default: 2 }),
} as const;
