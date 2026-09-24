import type { BooleanPropDef } from '@buildr/core';
import type { ControlProps } from './types.ts';

export function BooleanControl({
  id,
  def,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<BooleanPropDef>) {
  return (
    <input
      id={id}
      type="checkbox"
      className="bd-checkbox"
      checked={typeof value === 'boolean' ? value : def.default}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
