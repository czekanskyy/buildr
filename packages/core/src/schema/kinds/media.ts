import type { z } from 'zod';
import type { JsonValue } from '../../json/json-value.ts';
import type { DataTypeTag } from '../data-type.ts';
import {
  type CommonPropOptions,
  commonFields,
  jsonPropValueSchema,
  type PropDefBase,
} from './base.ts';

const MEDIA_ACCEPTS = ['media'] as const satisfies readonly DataTypeTag[];

export interface MediaOptions extends CommonPropOptions {
  /** Allowed media kinds, e.g. `['image']` — adapter-specific, kept as opaque strings in core. */
  readonly accept?: readonly string[];
}

/**
 * The concrete `MediaRef`/`MediaAsset` shape is adapter-specific (see docs/payload.md#media);
 * `@buildr/core` cannot depend on it, so this only guarantees JSON until an adapter's own value
 * lands (PB-013/PB-026).
 */
export interface MediaPropDef extends PropDefBase<'media'> {
  readonly accept?: readonly string[];
  readonly default: JsonValue;
}

export function buildMediaPropDef(options: MediaOptions = {}): MediaPropDef {
  return {
    kind: 'media',
    ...commonFields(options),
    localizable: options.localizable ?? false,
    accepts: MEDIA_ACCEPTS,
    default: null,
    ...(options.accept !== undefined ? { accept: options.accept } : {}),
  };
}

export function mediaValueSchema(_def: MediaPropDef): z.ZodType<JsonValue> {
  return jsonPropValueSchema;
}
