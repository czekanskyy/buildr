import { defineComponent } from '@buildr/react';
import { textareaProps } from './props.ts';
import { TextareaView } from './view.tsx';

/** A multi-line text field. Only valid inside a Form. */
export const Textarea = defineComponent({
  type: 'buildr/textarea',
  version: 1,
  label: 'Textarea',
  description: 'A multi-line text field.',
  keywords: ['message', 'comment', 'long text', 'form'],
  category: 'forms',
  icon: 'file-text',
  contentCategories: ['flow', 'phrasing', 'form-control'],
  parents: { requireAncestor: ['buildr/form'] },
  props: textareaProps,
  styles: {
    groups: ['size', 'spacing', 'typography', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'textarea', requiresName: true },
  formField: {
    valueType: 'string',
    nameProp: 'name',
    requiredProp: 'required',
    maxLengthProp: 'maxLength',
  },
  editor: { inlineProp: 'label', placeholder: 'Label' },
  runtime: 'shared',
  render: TextareaView,
});
