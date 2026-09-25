import { defineComponent } from '@buildr/react';
import { inputProps } from './props.ts';
import { InputView } from './view.tsx';

export { INPUT_TYPES } from './props.ts';

/** A single-line text field. Only valid inside a Form; its schema comes from `formField`. */
export const Input = defineComponent({
  type: 'buildr/input',
  version: 1,
  label: 'Input',
  description: 'A single-line text field.',
  keywords: ['text field', 'email', 'phone', 'form'],
  category: 'forms',
  icon: 'text-cursor-input',
  contentCategories: ['flow', 'phrasing', 'form-control'],
  parents: { requireAncestor: ['buildr/form'] },
  props: inputProps,
  styles: {
    groups: ['size', 'spacing', 'typography', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'input', requiresName: true },
  formField: {
    valueType: 'string',
    nameProp: 'name',
    requiredProp: 'required',
    maxLengthProp: 'maxLength',
  },
  editor: { inlineProp: 'label', placeholder: 'Label' },
  runtime: 'shared',
  render: InputView,
});
