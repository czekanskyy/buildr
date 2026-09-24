import { p } from '@buildr/core';

export const loopProps = {
  /** A collection query, or a list from the data (`post.related`). */
  source: p.listSource({ label: 'Source' }),
  /** Another name for `item` inside the template, so nested loops can reach the outer item. */
  as: p.text({ label: 'Item name', default: '' }),
} as const;
