import { defineComponent } from '@buildr/react';
import { sectionProps } from './props.ts';
import { SectionView } from './view.tsx';

export { SECTION_CONTAINERS, SECTION_ELEMENTS } from './props.ts';

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
