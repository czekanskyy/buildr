import { z } from 'zod';
import type { DataTypeTag } from '../data-type.ts';
import { type CommonPropOptions, commonFields, type PropDefBase } from './base.ts';

const BOOLEAN_ACCEPTS = ['boolean'] as const satisfies readonly DataTypeTag[];

export interface BooleanOptions extends CommonPropOptions {
  readonly default?: boolean;
}

export interface BooleanPropDef extends PropDefBase<'boolean'> {
  readonly default: boolean;
}

export function buildBooleanPropDef(options: BooleanOptions = {}): BooleanPropDef {
  return {
    kind: 'boolean',
    ...commonFields(options),
    localizable: options.localizable ?? false,
    accepts: BOOLEAN_ACCEPTS,
    default: options.default ?? false,
  };
}

export function booleanValueSchema(_def: BooleanPropDef): z.ZodType<boolean> {
  return z.boolean();
}
