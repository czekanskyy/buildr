import { z } from 'zod';
import type { DataTypeTag } from '../data-type.ts';
import { type CommonPropOptions, commonFields, type PropDefBase } from './base.ts';

const NUMBER_ACCEPTS = ['number'] as const satisfies readonly DataTypeTag[];

export interface NumberOptions extends CommonPropOptions {
  readonly default?: number;
  readonly min?: number;
  readonly max?: number;
  /** Inspector stepper granularity — a UI hint, not enforced by the validator. */
  readonly step?: number;
}

export interface NumberPropDef extends PropDefBase<'number'> {
  readonly default: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export function buildNumberPropDef(options: NumberOptions = {}): NumberPropDef {
  return {
    kind: 'number',
    ...commonFields(options),
    localizable: options.localizable ?? false,
    accepts: NUMBER_ACCEPTS,
    default: options.default ?? 0,
    ...(options.min !== undefined ? { min: options.min } : {}),
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.step !== undefined ? { step: options.step } : {}),
  };
}

export function numberValueSchema(def: NumberPropDef): z.ZodType<number> {
  let schema = z.number();
  if (def.min !== undefined) schema = schema.min(def.min);
  if (def.max !== undefined) schema = schema.max(def.max);
  return schema;
}
