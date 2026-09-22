import { z } from 'zod';
import type { DataTypeTag } from '../data-type.ts';
import { type CommonPropOptions, commonFields, type PropDefBase } from './base.ts';

// Icons are picked from a fixed library, not bound to CMS data, in MVP.
const ICON_ACCEPTS: readonly DataTypeTag[] = [];

export interface IconOptions extends CommonPropOptions {
  readonly default?: string;
}

export interface IconPropDef extends PropDefBase<'icon'> {
  readonly default: string;
}

export function buildIconPropDef(options: IconOptions = {}): IconPropDef {
  return {
    kind: 'icon',
    ...commonFields(options),
    localizable: options.localizable ?? false,
    accepts: ICON_ACCEPTS,
    default: options.default ?? '',
  };
}

export function iconValueSchema(_def: IconPropDef): z.ZodType<string> {
  return z.string();
}
