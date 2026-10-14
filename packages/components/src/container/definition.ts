import { s } from '@next-buildr/core';
import { defineComponent } from '@next-buildr/react';
import { containerProps } from './props.ts';
import { containerReplaces } from './replacements.ts';
import { ContainerView } from './view.tsx';

export {
  CONTAINER_DISPLAYS,
  CONTAINER_ELEMENTS,
  CONTAINER_ROLES,
  CONTAINER_WIDTHS,
} from './props.ts';

/**
 * A box for other components. `display` picks how it lays its children out; direction, wrap, gap and
 * alignment stay style properties (`layout.*`), so they change per breakpoint. It can be a
 * landmark, keep its content to a column, and carry a background image. It replaces the former
 * `buildr/stack` and `buildr/section` (ADR-025).
 */
export const Container = defineComponent({
  type: 'buildr/container',
  version: 2,
  label: 'Container',
  description:
    'A box for content: a column, row or grid, optionally width-limited, a landmark, or with a background image.',
  keywords: [
    'width',
    'column',
    'centre',
    'max-width',
    'stack',
    'flex',
    'row',
    'group',
    'section',
    'band',
    'hero',
    'wrapper',
    'grid',
  ],
  category: 'layout',
  icon: 'square-dashed',
  contentCategories: ['flow', 'landmark'],
  props: containerProps,
  slots: { default: { label: 'Content', axis: 'auto' } },
  styles: {
    groups: ['layout', 'size', 'spacing', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'div', landmark: true },
  editor: { emptySlotText: { default: 'Drop content here' } },
  runtime: 'shared',
  // Version 1 was always a block: keep stored containers as they were.
  migrations: { 2: (props) => ({ ...props, display: s('block') }) },
  replaces: containerReplaces,
  render: ContainerView,
});
