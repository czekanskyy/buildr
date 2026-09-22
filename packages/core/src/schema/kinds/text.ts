import { z } from 'zod';
import type { DataTypeTag } from '../data-type.ts';
import { type CommonPropOptions, commonFields, type PropDefBase } from './base.ts';

const TEXT_ACCEPTS = [
  'string',
  'number',
  'date',
  'enum',
  'url',
] as const satisfies readonly DataTypeTag[];

export interface TextOptions extends CommonPropOptions {
  readonly default?: string;
  readonly maxLength?: number;
}

export interface TextPropDef extends PropDefBase<'text'> {
  readonly default: string;
  readonly maxLength?: number;
}

export function buildTextPropDef(options: TextOptions = {}): TextPropDef {
  return {
    kind: 'text',
    ...commonFields(options),
    localizable: options.localizable ?? true,
    accepts: TEXT_ACCEPTS,
    default: options.default ?? '',
    ...(options.maxLength !== undefined ? { maxLength: options.maxLength } : {}),
  };
}

export function textValueSchema(def: TextPropDef): z.ZodType<string> {
  return def.maxLength === undefined ? z.string() : z.string().max(def.maxLength);
}
