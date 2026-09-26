import { p } from '@next-buildr/core';
import { commonFieldProps } from '../field/props.ts';

export const textareaProps = {
  ...commonFieldProps,
  rows: p.number({ label: 'Rows', min: 2, max: 30, default: 4 }),
  maxLength: p.number({ label: 'Maximum length (0: no limit)', min: 0, max: 100000 }),
  placeholder: p.text({ label: 'Placeholder', default: '', localizable: true }),
} as const;
