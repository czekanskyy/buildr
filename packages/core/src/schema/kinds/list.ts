import type { DataTypeTag } from '../data-type.ts';
import { type CommonPropOptions, commonFields, type PropDefBase } from './base.ts';

// A structural list of sub-props (e.g. nav items); `listSource` is the kind for a CMS-bound list.
const LIST_ACCEPTS: readonly DataTypeTag[] = [];

export interface ListOptions extends CommonPropOptions {
  readonly min?: number;
  readonly max?: number;
}

export interface ListPropDef<Item extends PropDefBase = PropDefBase> extends PropDefBase<'list'> {
  readonly of: Item;
  readonly min?: number;
  readonly max?: number;
  readonly default: readonly unknown[];
}

export function buildListPropDef<Item extends PropDefBase>(
  of: Item,
  options: ListOptions = {},
): ListPropDef<Item> {
  return {
    kind: 'list',
    ...commonFields(options),
    localizable: options.localizable ?? false,
    accepts: LIST_ACCEPTS,
    of,
    default: [],
    ...(options.min !== undefined ? { min: options.min } : {}),
    ...(options.max !== undefined ? { max: options.max } : {}),
  };
}
