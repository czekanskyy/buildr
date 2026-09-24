import type { IconPropDef } from '@buildr/core';
import { Input } from '../../../ui/index.ts';
import type { ControlProps } from './types.ts';

/** An icon is named (`arrow-right`); the picker with a preview comes with the icon library. */
export function IconControl({
  id,
  def,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<IconPropDef>) {
  return (
    <Input
      id={id}
      type="text"
      autoComplete="off"
      spellCheck={false}
      value={typeof value === 'string' ? value : def.default}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value.trim())}
    />
  );
}
