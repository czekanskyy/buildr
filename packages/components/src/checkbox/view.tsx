import type { BuilderComponentProps } from '@next-buildr/react';
import { controlId, describedBy, Field } from '../field/field.tsx';
import type { checkboxProps } from './props.ts';

export function CheckboxView({ props, root, node }: BuilderComponentProps<typeof checkboxProps>) {
  const id = controlId(node.id);
  return (
    <Field
      root={root}
      id={id}
      label={props.label}
      hideLabel={false}
      required={props.required}
      hint={props.hint}
      layout="inline"
    >
      <input
        id={id}
        className="bc-field__check"
        type="checkbox"
        name={props.name}
        required={props.required}
        {...(props.defaultChecked ? { defaultChecked: true } : {})}
        {...describedBy(id, props.hint)}
      />
    </Field>
  );
}
