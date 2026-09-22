import { z } from 'zod';
import type { FormatSpec, LocaleCode, Value } from './types.ts';

const localeCodeSchema: z.ZodType<LocaleCode> = z.string();

/** Schema for `FormatSpec` (docs/dynamic-bindings.md#the-value-model). */
export const formatSpecSchema: z.ZodType<FormatSpec> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('date'), style: z.enum(['short', 'medium', 'long', 'iso']) }),
  z.strictObject({
    type: z.literal('number'),
    minimumFractionDigits: z.number().optional(),
    maximumFractionDigits: z.number().optional(),
    style: z.enum(['decimal', 'percent']).optional(),
  }),
  z.strictObject({ type: z.literal('currency'), currency: z.string() }),
  z.strictObject({
    type: z.literal('text'),
    transform: z.enum(['upper', 'lower', 'capitalize']).optional(),
    truncate: z.number().optional(),
  }),
]);

function staticValueSchema<T>(inner: z.ZodType<T>) {
  return z.strictObject({
    kind: z.literal('static'),
    value: inner,
    l10n: z.record(localeCodeSchema, inner).optional(),
  });
}

function bindingValueSchema<T>(inner: z.ZodType<T>) {
  return z.strictObject({
    kind: z.literal('binding'),
    path: z.string(),
    format: formatSpecSchema.optional(),
    fallback: inner.optional(),
  });
}

function expressionValueSchema<T>(inner: z.ZodType<T>) {
  return z.strictObject({
    kind: z.literal('expression'),
    expr: z.string(),
    mode: z.enum(['formula', 'template']).optional(),
    l10n: z.record(localeCodeSchema, z.string()).optional(),
    fallback: inner.optional(),
  });
}

/**
 * Builds a `Value<T>` schema for a prop whose static/fallback values validate against `inner`
 * (docs/dynamic-bindings.md#the-value-model). An unknown `kind` is rejected (the union is
 * discriminated on `kind`, not `type`, to avoid confusion with `node.type`). `l10n` is only valid
 * on a `static` value or on an `expression` value in `template` mode — see
 * docs/i18n.md#model-shared-structure-localized-content.
 */
export function valueSchema<T>(inner: z.ZodType<T>): z.ZodType<Value<T>> {
  return z
    .discriminatedUnion('kind', [
      staticValueSchema(inner),
      bindingValueSchema(inner),
      expressionValueSchema(inner),
    ])
    .superRefine((value, ctx) => {
      if (value.kind === 'expression' && value.l10n !== undefined && value.mode !== 'template') {
        ctx.addIssue({
          code: 'custom',
          path: ['l10n'],
          message: 'l10n is only valid on an expression value in template mode',
        });
      }
    });
}
