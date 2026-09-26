import type { TextPropDef } from '@next-buildr/core';
import { Input } from '../../../ui/index.ts';
import type { ControlProps } from './types.ts';

export function TextControl({
  id,
  def,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<TextPropDef>) {
  return (
    <Input
      id={id}
      type="text"
      value={typeof value === 'string' ? value : def.default}
      maxLength={def.maxLength}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
