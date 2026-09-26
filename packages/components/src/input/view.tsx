import type { BuilderComponentProps } from '@next-buildr/react';
import { controlId, describedBy, Field } from '../field/field.tsx';
import { INPUT_TYPES, type inputProps } from './props.ts';

const TYPES: readonly string[] = INPUT_TYPES;

export function InputView({ props, root, node }: BuilderComponentProps<typeof inputProps>) {
  const id = controlId(node.id);
  const type = TYPES.includes(String(props.type)) ? String(props.type) : 'text';
  const max =
    typeof props.maxLength === 'number' && Number.isInteger(props.maxLength) && props.maxLength > 0
      ? props.maxLength
      : undefined;
  return (
    <Field
      root={root}
      id={id}
      label={props.label}
      hideLabel={props.hideLabel}
      required={props.required}
      hint={props.hint}
    >
      <input
        id={id}
        className="bc-field__control"
        name={props.name}
        type={type}
        required={props.required}
        {...(max !== undefined ? { maxLength: max } : {})}
        {...(props.placeholder !== '' ? { placeholder: props.placeholder } : {})}
        {...describedBy(id, props.hint)}
      />
    </Field>
  );
}
