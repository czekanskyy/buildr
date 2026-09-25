import { defineComponent } from '@buildr/react';
import { selectProps } from './props.ts';
import { SelectView } from './view.tsx';

/** A drop-down list of options. Only valid inside a Form; the schema allows exactly its option values. */
export const Select = defineComponent({
  type: 'buildr/select',
  version: 1,
  label: 'Select',
  description: 'A drop-down list.',
  keywords: ['dropdown', 'choice', 'options', 'form'],
  category: 'forms',
  icon: 'square-chevron-down',
  contentCategories: ['flow', 'phrasing', 'form-control'],
  parents: { requireAncestor: ['buildr/form'] },
  props: selectProps,
  styles: {
    groups: ['size', 'spacing', 'typography', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'select', requiresName: true },
  formField: {
    valueType: 'enum',
    nameProp: 'name',
    requiredProp: 'required',
    optionsProp: 'options',
  },
  editor: { inlineProp: 'label', placeholder: 'Label' },
  runtime: 'shared',
  render: SelectView,
});
