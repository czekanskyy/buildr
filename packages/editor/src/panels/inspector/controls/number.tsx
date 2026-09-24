import type { NumberPropDef } from '@buildr/core';
import { useEffect, useState } from 'react';
import { Input } from '../../../ui/index.ts';
import type { ControlProps } from './types.ts';

/** Whether `text` is a number the prop accepts (finite and inside its range). */
export function parseNumber(text: string, def: NumberPropDef): number | undefined {
  if (text.trim() === '') return undefined;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return undefined;
  if (def.min !== undefined && parsed < def.min) return undefined;
  if (def.max !== undefined && parsed > def.max) return undefined;
  return parsed;
}

/**
 * The text is a draft ("1." and "" are steps on the way to a number); only a valid number is
 * written, and leaving the field shows the stored value again.
 */
export function NumberControl({
  id,
  def,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<NumberPropDef>) {
  const current = typeof value === 'number' ? value : def.default;
  const [draft, setDraft] = useState(String(current));
  useEffect(() => {
    setDraft((shown) => (parseNumber(shown, def) === current ? shown : String(current)));
  }, [current, def]);
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      value={draft}
      min={def.min}
      max={def.max}
      step={def.step}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      onChange={(event) => {
        setDraft(event.target.value);
        const next = parseNumber(event.target.value, def);
        if (next !== undefined && next !== current) onChange(next);
      }}
      onBlur={() => setDraft(String(current))}
    />
  );
}
