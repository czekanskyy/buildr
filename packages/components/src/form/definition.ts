import { defineComponent } from '@buildr/react';
import { formProps } from './props.ts';
import { FormView } from './view.tsx';

/**
 * A form. It posts to `platform.formAction(layoutRef, nodeId)`, so it works as a plain HTML form
 * without JavaScript; with JavaScript a small enhancement sends it with `fetch` and reports the
 * result in a live region. What it accepts is decided on the server, from the document, by
 * `deriveFormSchema`: nothing here validates anything the server does not.
 */
export const Form = defineComponent({
  type: 'buildr/form',
  version: 1,
  label: 'Form',
  description: 'A form whose submissions are collected by the site.',
  keywords: ['contact', 'newsletter', 'submit', 'fields'],
  category: 'forms',
  icon: 'clipboard-list',
  contentCategories: ['flow'],
  props: formProps,
  slots: { default: { label: 'Fields', allow: ['#flow'], axis: 'vertical' } },
  styles: {
    groups: ['layout', 'size', 'spacing', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'form' },
  editor: { emptySlotText: { default: 'Add fields and a submit button' } },
  runtime: 'shared',
  render: FormView,
});
