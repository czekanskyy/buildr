import { z } from 'zod';
import type { DataTypeTag } from '../data-type.ts';
import { type CommonPropOptions, commonFields, type PropDefBase } from './base.ts';

// Not in the dynamic-bindings.md coercion table (only `text` is) — a multi-line block stays a
// plain string binding rather than also accepting number/date/enum/url like `text` does.
const TEXTAREA_ACCEPTS = ['string'] as const satisfies readonly DataTypeTag[];

export interface TextareaOptions extends CommonPropOptions {
  readonly default?: string;
  readonly maxLength?: number;
  /**
   * `'html'` marks author-supplied HTML (ADR-026): `node.setProp` refuses it unless the host sets
   * `capabilities.authorCode`, and stores only the sanitised form (`core/author`).
   */
  readonly format?: 'html';
}

export interface TextareaPropDef extends PropDefBase<'textarea'> {
  readonly default: string;
  readonly maxLength?: number;
  readonly format?: 'html';
}

export function buildTextareaPropDef(options: TextareaOptions = {}): TextareaPropDef {
  return {
    kind: 'textarea',
    ...commonFields(options),
    localizable: options.localizable ?? true,
    accepts: TEXTAREA_ACCEPTS,
    default: options.default ?? '',
    ...(options.maxLength !== undefined ? { maxLength: options.maxLength } : {}),
    ...(options.format !== undefined ? { format: options.format } : {}),
  };
}

export function textareaValueSchema(def: TextareaPropDef): z.ZodType<string> {
  return def.maxLength === undefined ? z.string() : z.string().max(def.maxLength);
}
