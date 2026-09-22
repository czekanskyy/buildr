import { z } from 'zod';
import type { DataTypeTag } from '../data-type.ts';
import { type CommonPropOptions, commonFields, type PropDefBase } from './base.ts';

const LINK_ACCEPTS = ['url', 'link', 'string'] as const satisfies readonly DataTypeTag[];

export interface LinkOptions extends CommonPropOptions {
  readonly default?: string;
}

/** `sanitizeUrl` (PB-020) is wired into resolution later; this only checks the value is a string. */
export interface LinkPropDef extends PropDefBase<'link'> {
  readonly default: string;
}

export function buildLinkPropDef(options: LinkOptions = {}): LinkPropDef {
  return {
    kind: 'link',
    ...commonFields(options),
    localizable: options.localizable ?? true,
    accepts: LINK_ACCEPTS,
    default: options.default ?? '',
  };
}

export function linkValueSchema(_def: LinkPropDef): z.ZodType<string> {
  return z.string();
}
