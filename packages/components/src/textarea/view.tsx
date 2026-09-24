import type { BuilderComponentProps } from '@buildr/react';
import { controlId, describedBy, Field } from '../field/field.tsx';
import type { textareaProps } from './props.ts';

export function TextareaView({ props, root, node }: BuilderComponentProps<typeof textareaProps>) {
  const id = controlId(node.id);
  const max =
    typeof props.maxLength === 'number' && Number.isInteger(props.maxLength) && props.maxLength > 0
      ? props.maxLength
      : undefined;
  const rows =
    typeof props.rows === 'number' &&
    Number.isInteger(props.rows) &&
    props.rows >= 2 &&
    props.rows <= 30
      ? props.rows
      : 4;
  return (
    <Field
      root={root}
      id={id}
      label={props.label}
      hideLabel={props.hideLabel}
      required={props.required}
      hint={props.hint}
    >
      <textarea
        id={id}
        className="bc-field__control"
        name={props.name}
        rows={rows}
        required={props.required}
        {...(max !== undefined ? { maxLength: max } : {})}
        {...(props.placeholder !== '' ? { placeholder: props.placeholder } : {})}
        {...describedBy(id, props.hint)}
      />
    </Field>
  );
}
