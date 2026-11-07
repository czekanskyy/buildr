import { p } from '@next-buildr/core';

/** Kept at the render boundary: the text prop DSL has no pattern constraint. */
export function isAnchorName(name: unknown): name is string {
  return typeof name === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(name) && !name.startsWith('bc-');
}

export const anchorProps = {
  name: p.text({ label: 'Name', default: '', bindable: false, localizable: false }),
} as const;
