import type { PropDef } from '@next-buildr/core';

/** What every prop control receives: the definition, the value to show, and how to change it. */
export interface ControlProps<D extends PropDef = PropDef> {
  /** The DOM id of the control itself (its label points at it). */
  readonly id: string;
  readonly def: D;
  /** The accessible name. */
  readonly label: string;
  /** The id of the hint text the control is described by, when there is one. */
  readonly describedBy: string | undefined;
  /** The value to show — the prop's own, or its default. Untrusted: a control checks its type. */
  readonly value: unknown;
  readonly disabled: boolean;
  readonly onChange: (value: unknown) => void;
}
