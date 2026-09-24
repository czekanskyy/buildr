import { p } from '@buildr/core';

/** The props every form field has. Its `name` is what the submission is keyed by, so it is not bindable. */
export const commonFieldProps = {
  label: p.text({ label: 'Label', default: 'Label', localizable: true }),
  /** Unique within the form; letters, digits, `-` and `_`, starting with a letter. */
  name: p.text({ label: 'Name', default: '', localizable: false, bindable: false }),
  required: p.boolean({ label: 'Required', default: false }),
  hint: p.text({ label: 'Hint', default: '', localizable: true }),
  /** Hides the label visually; it stays for assistive technology. */
  hideLabel: p.boolean({ label: 'Hide the label', default: false }),
} as const;
