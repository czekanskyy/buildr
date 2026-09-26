import type { BuilderComponentProps } from '@next-buildr/react';
import { createElement } from 'react';
import { HEADING_LEVELS, type headingProps } from './props.ts';

const LEVELS: readonly number[] = HEADING_LEVELS;

export function HeadingView({ props, root }: BuilderComponentProps<typeof headingProps>) {
  const requested = Number(props.level);
  // A stored level outside 1-6 (a bad edit, a migration gap) still renders a heading, at the default.
  const level = LEVELS.includes(requested) ? requested : 2;
  return createElement(`h${level}`, { ...root, 'data-level': level }, props.text);
}
