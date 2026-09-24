import { z } from 'zod';
import type { Value } from '../document/types.ts';
import { isJsonValue, type JsonValue } from '../json/json-value.ts';
import { valueSchema } from '../values/schema.ts';
import { parsePath } from './path.ts';

/** Max `limit` of a query (docs/dynamic-bindings.md#lists-and-queries-loop-query). */
export const MAX_QUERY_LIMIT = 50;
/** Max nesting of `and`/`or` groups in a `where` filter. */
export const MAX_FILTER_DEPTH = 4;
/** Max condition and group nodes in a `where` filter. */
export const MAX_FILTER_NODES = 32;
/** Max sort keys. */
export const MAX_SORT_KEYS = 4;

export const FILTER_OPS = [
  'eq',
  'neq',
  'in',
  'nin',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'exists',
] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

/** A filter tree; `V` is the type of a condition's operand (`Value` in a spec, `JsonValue` once resolved). */
export type FilterNode<V> =
  | { readonly and: readonly FilterNode<V>[] }
  | { readonly or: readonly FilterNode<V>[] }
  | { readonly field: string; readonly op: FilterOp; readonly value: V };

export interface QuerySort {
  readonly field: string;
  readonly dir: 'asc' | 'desc';
}

/**
 * A declarative collection query (docs/dynamic-bindings.md#lists-and-queries-loop-query, ADR-018).
 * Operands and `page` are `Value`s so a query can depend on the route (`route.params.page`).
 */
export interface QuerySpec {
  /** A collection alias from the adapter's allowlist. */
  readonly source: string;
  readonly where?: FilterNode<Value> | undefined;
  readonly sort?: readonly QuerySort[] | undefined;
  /** 1..`MAX_QUERY_LIMIT`. */
  readonly limit: number;
  readonly page?: Value<number> | undefined;
  /** Leave the document currently being rendered out of the results ("related posts"). */
  readonly excludeCurrent?: boolean | undefined;
}

/** A `QuerySpec` with every `Value` resolved — what a `DataSource` receives. */
export interface ResolvedQuerySpec {
  readonly source: string;
  readonly where?: FilterNode<JsonValue> | undefined;
  readonly sort?: readonly QuerySort[] | undefined;
  readonly limit: number;
  /** 1-based. */
  readonly page: number;
  /** The `id` of an item to leave out (from `excludeCurrent`). */
  readonly excludeId?: string | number | undefined;
}

const jsonSchema: z.ZodType<JsonValue> = z.custom<JsonValue>(isJsonValue, {
  message: 'must be a JSON value',
});

const fieldSchema = z.string().refine((field) => parsePath(field).ok, {
  message: 'must be a plain field path such as "author.name"',
});

function filterSchemaOf<V>(operand: z.ZodType<V>): z.ZodType<FilterNode<V>> {
  const node: z.ZodType<FilterNode<V>> = z.lazy(() =>
    z.union([
      z.strictObject({ and: z.array(node).min(1).max(MAX_FILTER_NODES) }),
      z.strictObject({ or: z.array(node).min(1).max(MAX_FILTER_NODES) }),
      z.strictObject({ field: fieldSchema, op: z.enum(FILTER_OPS), value: operand }),
    ]),
  );
  return node;
}

/** Depth and node count of a filter tree (a leaf is depth 1 and one node). */
function measure(filter: FilterNode<unknown>): { depth: number; nodes: number } {
  if ('and' in filter || 'or' in filter) {
    const children = 'and' in filter ? filter.and : filter.or;
    let depth = 0;
    let nodes = 1;
    for (const child of children) {
      const m = measure(child);
      depth = Math.max(depth, m.depth);
      nodes += m.nodes;
    }
    return { depth: depth + 1, nodes };
  }
  return { depth: 1, nodes: 1 };
}

function limitedFilter<V>(operand: z.ZodType<V>): z.ZodType<FilterNode<V>> {
  return filterSchemaOf(operand).refine(
    (filter) => {
      const { depth, nodes } = measure(filter);
      return depth <= MAX_FILTER_DEPTH + 1 && nodes <= MAX_FILTER_NODES;
    },
    { message: `a filter may nest ${MAX_FILTER_DEPTH} groups and hold ${MAX_FILTER_NODES} nodes` },
  );
}

const sourceSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/, 'must be a collection alias');
const sortSchema = z
  .array(z.strictObject({ field: fieldSchema, dir: z.enum(['asc', 'desc']) }))
  .max(MAX_SORT_KEYS);
const limitSchema = z.number().int().min(1).max(MAX_QUERY_LIMIT);

/** Validates a `QuerySpec` from the document (or from an HTTP request body). */
export const querySpecSchema: z.ZodType<QuerySpec> = z.strictObject({
  source: sourceSchema,
  where: limitedFilter(valueSchema(jsonSchema)).optional(),
  sort: sortSchema.optional(),
  limit: limitSchema,
  page: valueSchema(z.number()).optional(),
  excludeCurrent: z.boolean().optional(),
});

/** Validates a `ResolvedQuerySpec` at a `DataSource` boundary (e.g. the plugin's query endpoint). */
export const resolvedQuerySpecSchema: z.ZodType<ResolvedQuerySpec> = z.strictObject({
  source: sourceSchema,
  where: limitedFilter(jsonSchema).optional(),
  sort: sortSchema.optional(),
  limit: limitSchema,
  page: z.number().int().min(1),
  excludeId: z.union([z.string(), z.number()]).optional(),
});
