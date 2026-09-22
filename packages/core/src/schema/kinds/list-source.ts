import type { z } from 'zod';
import type { JsonValue } from '../../json/json-value.ts';
import type { DataTypeTag } from '../data-type.ts';
import {
  type CommonPropOptions,
  commonFields,
  jsonPropValueSchema,
  type PropDefBase,
} from './base.ts';

const LIST_SOURCE_ACCEPTS = ['list'] as const satisfies readonly DataTypeTag[];

export interface ListSourceOptions extends CommonPropOptions {
  /** A collection-alias allowlist, e.g. `['posts', 'products']` (docs/dynamic-bindings.md#lists-and-queries-loop-query). */
  readonly accept?: readonly string[];
}

/**
 * Resolves to `{ type: 'binding', path } | { type: 'query', spec: QuerySpec }`
 * (docs/dynamic-bindings.md#lists-and-queries-loop-query); `QuerySpec` lands with PB-026, so this
 * only guarantees JSON until then.
 */
export interface ListSourcePropDef extends PropDefBase<'listSource'> {
  readonly accept?: readonly string[];
  readonly default: JsonValue;
}

export function buildListSourcePropDef(options: ListSourceOptions = {}): ListSourcePropDef {
  return {
    kind: 'listSource',
    ...commonFields(options),
    localizable: options.localizable ?? false,
    accepts: LIST_SOURCE_ACCEPTS,
    default: null,
    ...(options.accept !== undefined ? { accept: options.accept } : {}),
  };
}

export function listSourceValueSchema(_def: ListSourcePropDef): z.ZodType<JsonValue> {
  return jsonPropValueSchema;
}
