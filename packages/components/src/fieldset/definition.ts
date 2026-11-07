import { defineComponent } from '@next-buildr/react';
import { fieldsetProps } from './props.ts';
import { FieldsetView } from './view.tsx';
export const Fieldset = defineComponent({
  type: 'buildr/fieldset',
  version: 1,
  label: 'Fieldset',
  description: 'A named group of form controls.',
  category: 'forms',
  icon: 'group',
  contentCategories: ['flow'],
  parents: { requireAncestor: ['buildr/form'] },
  props: fieldsetProps,
  slots: { default: { label: 'Content', allow: ['#flow'], axis: 'vertical' } },
  styles: { groups: ['size', 'spacing', 'typography', 'background', 'border', 'visibility'] },
  a11y: { element: 'fieldset' },
  editor: { inlineProp: 'legend', placeholder: 'Legend' },
  runtime: 'shared',
  render: FieldsetView,
});
