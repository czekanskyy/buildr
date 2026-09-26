import type { LinkPropDef } from '@next-buildr/core';
import { Input } from '../../../ui/index.ts';
import type { ControlProps } from './types.ts';

/** The address is free text here; what a link may point at is checked by the property's own schema on write. */
export function LinkControl({
  id,
  def,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<LinkPropDef>) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="url"
      autoComplete="off"
      spellCheck={false}
      value={typeof value === 'string' ? value : def.default}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
