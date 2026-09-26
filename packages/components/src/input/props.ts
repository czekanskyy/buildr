import { p } from '@next-buildr/core';
import { commonFieldProps } from '../field/props.ts';

export const INPUT_TYPES = ['text', 'email', 'tel', 'url', 'number'] as const;

export const inputProps = {
  ...commonFieldProps,
  type: p.select({ label: 'Type', options: INPUT_TYPES, default: 'text' }),
  maxLength: p.number({ label: 'Maximum length (0: no limit)', min: 0, max: 10000 }),
  placeholder: p.text({ label: 'Placeholder', default: '', localizable: true }),
} as const;
