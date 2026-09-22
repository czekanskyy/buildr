import { z } from 'zod';
import type { DataTypeTag } from '../data-type.ts';
import { type CommonPropOptions, commonFields, type PropDefBase } from './base.ts';

// Not in the dynamic-bindings.md coercion table — a fixed option set isn't bound to a CMS field in
// MVP (and the `enum` DataType only carries string values, while `select` options may be numeric).
const SELECT_ACCEPTS: readonly DataTypeTag[] = [];

export interface SelectOptions extends CommonPropOptions {
  readonly options: readonly [string | number, ...(string | number)[]];
  readonly default?: string | number;
}

export interface SelectPropDef extends PropDefBase<'select'> {
  readonly options: readonly [string | number, ...(string | number)[]];
  readonly default: string | number;
}

export function buildSelectPropDef(options: SelectOptions): SelectPropDef {
  return {
    kind: 'select',
    ...commonFields(options),
    localizable: options.localizable ?? false,
    accepts: SELECT_ACCEPTS,
    options: options.options,
    default: options.default ?? options.options[0],
  };
}

export function selectValueSchema(def: SelectPropDef): z.ZodType<string | number> {
  const options = def.options;
  return z.union([z.string(), z.number()]).refine((value) => options.includes(value), {
    message: `must be one of: ${options.join(', ')}`,
  });
}
