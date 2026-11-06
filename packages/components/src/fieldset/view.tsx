import type { BuilderComponentProps } from '@next-buildr/react';
import type { fieldsetProps } from './props.ts';
export function FieldsetView({
  props,
  root,
  children,
}: BuilderComponentProps<typeof fieldsetProps>) {
  return (
    <fieldset {...root} disabled={props.disabled}>
      {props.legend?.trim() ? <legend>{props.legend}</legend> : null}
      {children}
    </fieldset>
  );
}
