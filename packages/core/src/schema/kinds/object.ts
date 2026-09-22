import type { DataTypeTag } from '../data-type.ts';
import { type CommonPropOptions, commonFields, type PropDefBase } from './base.ts';

const OBJECT_ACCEPTS: readonly DataTypeTag[] = [];

export type ObjectOptions = CommonPropOptions;

export interface ObjectPropDef<
  Fields extends Record<string, PropDefBase> = Record<string, PropDefBase>,
> extends PropDefBase<'object'> {
  readonly fields: Fields;
  readonly default: Readonly<Record<string, unknown>>;
}

export function buildObjectPropDef<Fields extends Record<string, PropDefBase>>(
  fields: Fields,
  options: ObjectOptions = {},
): ObjectPropDef<Fields> {
  const defaultValue: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields)) defaultValue[key] = field.default;
  return {
    kind: 'object',
    ...commonFields(options),
    localizable: options.localizable ?? false,
    accepts: OBJECT_ACCEPTS,
    fields,
    default: defaultValue,
  };
}
