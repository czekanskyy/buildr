import { z } from 'zod';
import { isJsonValue, type JsonValue } from '../../json/json-value.ts';
import type { DataTypeTag } from '../data-type.ts';

/**
 * Fields every prop kind carries, denormalized directly onto the serialized `PropDef` so the
 * editor never has to consult a live kind registry (see docs/component-registry.md#props-dsl-p).
 */
export interface PropDefBase<Kind extends string = string> {
  readonly kind: Kind;
  readonly label?: string;
  readonly group?: string;
  readonly bindable?: boolean;
  readonly required?: boolean;
  /** Whether a `Value` bound to this prop is translated per-locale (docs/i18n.md). */
  readonly localizable: boolean;
  /** Which `DataType` tags this kind accepts as a binding target (docs/dynamic-bindings.md#data-types-and-the-data-schema). */
  readonly accepts: readonly DataTypeTag[];
  readonly default: unknown;
}

/** Options shared by every `p.*` builder. */
export interface CommonPropOptions {
  readonly label?: string;
  readonly group?: string;
  readonly bindable?: boolean;
  readonly required?: boolean;
  /** Overrides the kind's own default from docs/i18n.md#model-shared-structure-localized-content. */
  readonly localizable?: boolean;
}

export function commonFields(
  options: CommonPropOptions,
): Pick<PropDefBase, 'label' | 'group' | 'bindable' | 'required'> {
  return {
    ...(options.label !== undefined ? { label: options.label } : {}),
    ...(options.group !== undefined ? { group: options.group } : {}),
    ...(options.bindable !== undefined ? { bindable: options.bindable } : {}),
    ...(options.required !== undefined ? { required: options.required } : {}),
  };
}

/**
 * Shared by the kinds whose full value shape lands in a later phase (`richText`, `media`,
 * `listSource`) — until then, a value only has to be well-formed JSON.
 */
export const jsonPropValueSchema: z.ZodType<JsonValue> = z.custom<JsonValue>(isJsonValue, {
  message: 'must be a JSON value',
});
