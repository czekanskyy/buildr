import type { SelectPropDef } from '@next-buildr/core';
import { Select } from '../../../ui/index.ts';
import type { ControlProps } from './types.ts';

/** Options may be numbers; the menu deals in strings, so the choice is looked up again by its text. */
export function SelectControl({
  def,
  label,
  value,
  disabled,
  onChange,
}: ControlProps<SelectPropDef>) {
  const current = def.options.includes(value as string | number)
    ? (value as string | number)
    : def.default;
  return (
    <Select
      label={label}
      value={String(current)}
      disabled={disabled}
      options={def.options.map((option) => ({ value: String(option), label: String(option) }))}
      onValueChange={(chosen) => {
        const option = def.options.find((candidate) => String(candidate) === chosen);
        if (option !== undefined) onChange(option);
      }}
    />
  );
}
