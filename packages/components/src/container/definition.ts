import { s } from '@next-buildr/core';
import { defineComponent } from '@next-buildr/react';
import { containerProps } from './props.ts';
import { containerReplaces } from './replacements.ts';
import { ContainerView } from './view.tsx';

export {
  BACKGROUND_ATTACHMENTS,
  BACKGROUND_FITS,
  BACKGROUND_POSITIONS,
  CONTAINER_DISPLAYS,
  CONTAINER_ELEMENTS,
  CONTAINER_ROLES,
  CONTAINER_WIDTHS,
  OVERLAY_TONES,
} from './props.ts';

/**
 * A box for other components. `display` picks how it lays its children out; direction, wrap, gap and
 * alignment stay style properties (`layout.*`), so they change per breakpoint. It can be a
 * landmark, keep its content to a column, and carry background media (an image, a looping muted
 * video with a poster, an overlay). Media comes from the media library or, after the editor's
 * confirmation, an external HTTPS URL (ADR-028). It replaces the former
 * `buildr/stack` and `buildr/section` (ADR-025).
 */
export const Container = defineComponent({
  type: 'buildr/container',
  version: 3,
  label: 'Container',
  description:
    'A box for content: a column, row or grid, optionally width-limited, a landmark, or with a background image or video.',
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
    'video',
    'overlay',
    'background',
  ],
  category: 'layout',
  icon: 'square-dashed',
  contentCategories: ['flow', 'landmark'],
  props: containerProps,
  slots: { default: { label: 'Content', axis: 'auto' } },
  styles: {
    groups: [
      'layout',
      'size',
      'spacing',
      'typography',
      'background',
      'border',
      'effects',
      'motion',
      'visibility',
    ],
  },
  a11y: { element: 'div', landmark: true },
  editor: { emptySlotText: { default: 'Drop content here' } },
  runtime: 'shared',
  // Version 1 was always a block: keep stored containers as they were.
  migrations: {
    2: (props) => ({ ...props, display: s('block') }),
    // Version 3 added the background video, poster, overlay, fit, position and scrolling props. A
    // stored container has none of them, which already means "no video, no overlay, cover, centre,
    // scroll", so its props do not change (ADR-014, ADR-028).
    3: (props) => props,
  },
  replaces: containerReplaces,
  render: ContainerView,
});
