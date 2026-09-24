import { p } from '@buildr/core';

/** Elements a section may be: the sectioning and landmark elements that take flow content. */
export const SECTION_ELEMENTS = [
  'section',
  'div',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'article',
] as const;

/** Widths of the content column, from the theme's `container` tokens; `full` spans the section. */
export const SECTION_CONTAINERS = ['full', 'sm', 'md', 'lg', 'xl'] as const;

export const sectionProps = {
  as: p.select({ label: 'Element', options: SECTION_ELEMENTS, default: 'section' }),
  container: p.select({
    label: 'Content width',
    options: SECTION_CONTAINERS,
    default: 'lg',
  }),
  backgroundImage: p.media({ label: 'Background image', accept: ['image'], bindable: true }),
  ariaLabel: p.text({ label: 'Accessible name', localizable: true }),
} as const;
