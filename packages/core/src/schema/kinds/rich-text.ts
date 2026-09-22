import type { z } from 'zod';
import type { JsonValue } from '../../json/json-value.ts';
import type { DataTypeTag } from '../data-type.ts';
import {
  type CommonPropOptions,
  commonFields,
  jsonPropValueSchema,
  type PropDefBase,
} from './base.ts';

const RICH_TEXT_ACCEPTS = ['richText', 'string'] as const satisfies readonly DataTypeTag[];

export type RichTextOptions = CommonPropOptions;

/**
 * The value is only guaranteed to be JSON here; the constrained Lexical-subset AST (ADR-017) gets
 * its own `richTextSchema` once PB-020 lands.
 */
export interface RichTextPropDef extends PropDefBase<'richText'> {
  readonly default: JsonValue;
}

export function buildRichTextPropDef(options: RichTextOptions = {}): RichTextPropDef {
  return {
    kind: 'richText',
    ...commonFields(options),
    localizable: options.localizable ?? true,
    accepts: RICH_TEXT_ACCEPTS,
    default: null,
  };
}

export function richTextValueSchema(_def: RichTextPropDef): z.ZodType<JsonValue> {
  return jsonPropValueSchema;
}
