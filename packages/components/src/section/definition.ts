import { p } from '@buildr/core';
import { defineComponent } from '@buildr/react';
import { SectionView } from './view.tsx';

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

/** A full-width band of the page whose content is kept to a readable column. */
export const Section = defineComponent({
  type: 'buildr/section',
  version: 1,
  label: 'Section',
  description:
    'A band of the page: a landmark or a plain wrapper, with an optional background image.',
  keywords: ['band', 'region', 'hero', 'wrapper'],
  category: 'layout',
  icon: 'layout-grid',
  contentCategories: ['flow', 'landmark'],
  props: sectionProps,
  slots: { default: { label: 'Content', axis: 'vertical' } },
  styles: {
    groups: ['layout', 'size', 'spacing', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'section', landmark: true },
  editor: { emptySlotText: { default: 'Drop content here' } },
  runtime: 'shared',
  render: SectionView,
});
