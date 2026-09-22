import { z } from 'zod';

/**
 * A serializable description of a value's shape, used by `DataSchema` (PB-019) and by
 * `PropDef.accepts` to say which bindings a prop can take (see
 * docs/dynamic-bindings.md#data-types-and-the-data-schema).
 */
export type DataType =
  | { readonly t: 'string' }
  | { readonly t: 'number' }
  | { readonly t: 'boolean' }
  | { readonly t: 'date' }
  | { readonly t: 'url' }
  | { readonly t: 'richText' }
  | { readonly t: 'media' }
  | { readonly t: 'link' }
  | { readonly t: 'enum'; readonly values: readonly string[] }
  | { readonly t: 'object'; readonly fields: Readonly<Record<string, DataField>> }
  | { readonly t: 'list'; readonly of: DataType }
  | { readonly t: 'ref'; readonly entity: string };

/**
 * `DataType['t']` on its own, with no payload — what `PropDef.accepts` carries, since a prop
 * cares which tags a binding may resolve to, not the full nested shape.
 */
export type DataTypeTag = DataType['t'];

export interface DataField {
  readonly type: DataType;
  // `| undefined` (not just `?`) so this structurally matches Zod's own `.optional()` output
  // under `exactOptionalPropertyTypes` (see `dataTypeSchema`/`dataFieldSchema` below).
  readonly label?: string | undefined;
  readonly nullable?: boolean | undefined;
  readonly description?: string | undefined;
}

export const dataTypeSchema: z.ZodType<DataType> = z.lazy(() =>
  z.discriminatedUnion('t', [
    z.strictObject({ t: z.literal('string') }),
    z.strictObject({ t: z.literal('number') }),
    z.strictObject({ t: z.literal('boolean') }),
    z.strictObject({ t: z.literal('date') }),
    z.strictObject({ t: z.literal('url') }),
    z.strictObject({ t: z.literal('richText') }),
    z.strictObject({ t: z.literal('media') }),
    z.strictObject({ t: z.literal('link') }),
    z.strictObject({ t: z.literal('enum'), values: z.array(z.string()) }),
    z.strictObject({ t: z.literal('object'), fields: z.record(z.string(), dataFieldSchema) }),
    z.strictObject({ t: z.literal('list'), of: dataTypeSchema }),
    z.strictObject({ t: z.literal('ref'), entity: z.string() }),
  ]),
);

export const dataFieldSchema: z.ZodType<DataField> = z.lazy(() =>
  z.strictObject({
    type: dataTypeSchema,
    label: z.string().optional(),
    nullable: z.boolean().optional(),
    description: z.string().optional(),
  }),
);
