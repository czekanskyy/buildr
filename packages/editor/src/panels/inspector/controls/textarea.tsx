import type { TextareaPropDef } from '@buildr/core';
import type { ControlProps } from './types.ts';

export function TextareaControl({
  id,
  def,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<TextareaPropDef>) {
  return (
    <textarea
      id={id}
      className="bd-input bd-textarea"
      rows={4}
      value={typeof value === 'string' ? value : def.default}
      maxLength={def.maxLength}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
