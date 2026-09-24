import { p } from '@buildr/core';
import { commonFieldProps } from '../field/props.ts';

const { hideLabel: _hideLabel, ...fieldProps } = commonFieldProps;

export const checkboxProps = {
  ...fieldProps,
  /** Starts ticked. */
  defaultChecked: p.boolean({ label: 'Ticked at first', default: false }),
} as const;
