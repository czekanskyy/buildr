import { p } from '@next-buildr/core';
import { commonFieldProps } from '../field/props.ts';

export const selectProps = {
  ...commonFieldProps,
  /** What can be chosen: `value` is what is submitted, `label` what is shown. */
  options: p.list(
    p.object({
      label: p.text({ label: 'Label', default: 'Option', localizable: true }),
      value: p.text({ label: 'Value', default: '', localizable: false }),
    }),
    { label: 'Options', max: 500 },
  ),
  /** The first, empty choice ("Choose…"); leave it empty to have none. */
  placeholder: p.text({ label: 'Placeholder', default: '', localizable: true }),
} as const;
