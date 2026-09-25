import { defineComponent } from '@buildr/react';
import { checkboxProps } from './props.ts';
import { CheckboxView } from './view.tsx';

/** A tick box: a yes or a no. Only valid inside a Form. Its label is always visible. */
export const Checkbox = defineComponent({
  type: 'buildr/checkbox',
  version: 1,
  label: 'Checkbox',
  description: 'A tick box.',
  keywords: ['tick', 'consent', 'agree', 'boolean', 'form'],
  category: 'forms',
  icon: 'square-check',
  contentCategories: ['flow', 'phrasing', 'form-control'],
  parents: { requireAncestor: ['buildr/form'] },
  props: checkboxProps,
  styles: { groups: ['spacing', 'typography', 'background', 'border', 'effects', 'visibility'] },
  a11y: { element: 'input', requiresName: true },
  formField: { valueType: 'boolean', nameProp: 'name', requiredProp: 'required' },
  editor: { inlineProp: 'label', placeholder: 'Label' },
  runtime: 'shared',
  render: CheckboxView,
});
