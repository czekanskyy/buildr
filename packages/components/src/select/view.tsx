import type { BuilderComponentProps } from '@next-buildr/react';
import { controlId, describedBy, Field } from '../field/field.tsx';
import type { selectProps } from './props.ts';

interface Option {
  readonly label: string;
  readonly value: string;
}

/** The options that can be shown: entries with a value; anything else in the stored list is skipped. */
function optionsOf(value: unknown): Option[] {
  if (!Array.isArray(value)) return [];
  const out: Option[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { label, value: v } = entry as { label?: unknown; value?: unknown };
    if (typeof v !== 'string' || v === '') continue;
    out.push({ label: typeof label === 'string' && label !== '' ? label : v, value: v });
  }
  return out;
}

export function SelectView({ props, root, node }: BuilderComponentProps<typeof selectProps>) {
  const id = controlId(node.id);
  const options = optionsOf(props.options);
  return (
    <Field
      root={root}
      id={id}
      label={props.label}
      hideLabel={props.hideLabel}
      required={props.required}
      hint={props.hint}
    >
      <select
        id={id}
        className="bc-field__control"
        name={props.name}
        required={props.required}
        defaultValue=""
        {...describedBy(id, props.hint)}
      >
        {props.placeholder !== '' || props.required ? (
          <option value="" disabled={props.required}>
            {props.placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
