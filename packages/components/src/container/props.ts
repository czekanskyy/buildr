import { p } from '@next-buildr/core';

/** How the container lays out its children; `block` is the plain box. */
export const CONTAINER_DISPLAYS = ['flex', 'block', 'grid', 'inline-flex', 'inline-block'] as const;

/** Elements a container may be: the sectioning and landmark elements that take flow content. */
export const CONTAINER_ELEMENTS = [
  'div',
  'section',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'article',
] as const;

/** Widths of the content column, from the theme's `container` tokens; `none` lifts the limit. */
export const CONTAINER_WIDTHS = ['none', 'sm', 'md', 'lg', 'xl'] as const;

/**
 * `none` adds no role; `group` needs an accessible name; `list` needs `buildr/list-item` children.
 * Applied only when the element is a `div`: a landmark or sectioning element keeps its own role.
 */
export const CONTAINER_ROLES = ['none', 'group', 'list'] as const;

export const containerProps = {
  display: p.select({
    label: 'Display',
    options: CONTAINER_DISPLAYS,
    default: 'flex',
    optionLabels: {
      flex: 'Flex',
      block: 'Box',
      grid: 'Grid',
      'inline-flex': 'Inline flex',
      'inline-block': 'Inline box',
    },
  }),
  as: p.select({ label: 'Element', options: CONTAINER_ELEMENTS, default: 'div' }),
  width: p.select({
    label: 'Max width',
    options: CONTAINER_WIDTHS,
    default: 'lg',
    optionLabels: { none: 'No limit' },
  }),
  bleed: p.boolean({ label: 'Full-width background', default: false }),
  backgroundImage: p.media({ label: 'Background image', accept: ['image'], bindable: true }),
  role: p.select({ label: 'Role (plain div only)', options: CONTAINER_ROLES, default: 'none' }),
  ariaLabel: p.text({ label: 'Accessible name', localizable: true }),
} as const;
