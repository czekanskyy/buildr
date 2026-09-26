import type { NodeRoot } from '@next-buildr/react';
import type { ReactNode } from 'react';

export interface FieldProps {
  readonly root: NodeRoot;
  /** The id of the control the label belongs to. */
  readonly id: string;
  readonly label: string;
  readonly hideLabel: boolean;
  readonly required: boolean;
  readonly hint: string;
  /** `inline` puts the label after the control, as a checkbox has it. */
  readonly layout?: 'stacked' | 'inline';
  readonly children: ReactNode;
}

/** The ids the control wires up with `aria-describedby`: its hint, and where an error will be shown. */
export const hintId = (id: string): string => `${id}-hint`;
export const errorId = (id: string): string => `${id}-error`;

/**
 * The wrapper of a field: one root element holding the label, the control, the hint and a place
 * for an error. The label is a real `<label for>`, so the control is named without any ARIA; a
 * hidden label stays in the accessibility tree. The error element is empty until the form's
 * enhancement (or nothing, without JavaScript) puts a message in it.
 */
export function Field({
  root,
  id,
  label,
  hideLabel,
  required,
  hint,
  layout = 'stacked',
  children,
}: FieldProps) {
  const labelElement = (
    <label htmlFor={id} className={hideLabel ? 'bc-visually-hidden' : 'bc-field__label'}>
      {label}
      {required ? (
        <span className="bc-field__required" aria-hidden="true">
          {' '}
          *
        </span>
      ) : null}
    </label>
  );
  return (
    <div {...root} data-layout={layout}>
      {layout === 'stacked' ? labelElement : null}
      {children}
      {layout === 'inline' ? labelElement : null}
      {hint !== '' ? (
        <p id={hintId(id)} className="bc-field__hint">
          {hint}
        </p>
      ) : null}
      <p id={errorId(id)} className="bc-field__error" role="alert" hidden />
    </div>
  );
}

/** `aria-describedby` for a control: its hint when it has one. The error id is added when an error is shown. */
export function describedBy(id: string, hint: string): { 'aria-describedby'?: string } {
  return hint !== '' ? { 'aria-describedby': hintId(id) } : {};
}

/** A control's id, from its node id, so two fields on a page never share one. */
export const controlId = (nodeId: string): string => `f-${nodeId}`;
