import { createElement, type ReactElement, type SVGProps } from 'react';
import { ICON_NODES } from './nodes.ts';
import type { IconShape } from './types.ts';

/** The only tags an icon may draw with; the data is trusted, but rendering stays an allowlist. */
const SHAPE_TAGS: ReadonlySet<string> = new Set([
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
]);

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'name'> & {
  /** A name from `ICON_NAMES`. An unknown name renders nothing. */
  readonly name: string;
  /** CSS size of the square icon; defaults to `1em`. */
  readonly size?: number | string;
  /** Names the icon for assistive technology. Without it the icon is decorative and hidden from it. */
  readonly label?: string;
};

function shapes(name: string): readonly IconShape[] | undefined {
  return Object.hasOwn(ICON_NODES, name)
    ? (ICON_NODES as Readonly<Record<string, readonly IconShape[]>>)[name]
    : undefined;
}

export function hasIcon(name: string): boolean {
  return shapes(name) !== undefined;
}

/**
 * A stroked 24x24 icon built as React elements from path data (never from an HTML string), coloured
 * by `currentColor`. Shared runtime: no hooks or context.
 */
export function Icon({ name, size = '1em', label, ...rest }: IconProps): ReactElement | null {
  const nodes = shapes(name);
  if (nodes === undefined) return null;
  return createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      focusable: 'false',
      ...(label !== undefined ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }),
      ...rest,
    },
    nodes
      .filter(([tag]) => SHAPE_TAGS.has(tag))
      .map(([tag, attributes], index) => createElement(tag, { key: index, ...attributes })),
  );
}
