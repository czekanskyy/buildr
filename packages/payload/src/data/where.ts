import type { FilterNode, JsonValue } from '@next-buildr/core';
import type { Where } from 'payload';
import {
  type CollectionLike,
  exposedFields,
  type FieldLike,
  isExposedCollection,
} from './schema-from-fields.ts';

/**
 * How a query field behaves in Payload's `where`, decided from the collection config:
 * - `string` | `number` | `boolean` | `date` | `id`: scalars whose comparisons Payload evaluates
 *   the way the `DataSource` contract wants (typed, missing never matches);
 * - `unsafe`: anything else (lists, rich text, ...): Payload cannot decide it, so the condition is
 *   evaluated in memory on the normalized items.
 */
export type FieldKind = 'string' | 'number' | 'boolean' | 'date' | 'id' | 'unsafe';

export interface QueryField {
  readonly kind: FieldKind;
  /** May the value be missing (an optional field, or one behind an optional relation)? */
  readonly nullable: boolean;
  /** The path in Payload's `where` / `sort`. */
  readonly payloadPath: string;
}

export interface IdType {
  readonly kind: 'number' | 'text';
}

/** The field named `name` among `fields`, layout containers and unnamed tabs looked through. */
const findField = (fields: readonly FieldLike[], name: string) =>
  exposedFields(fields).find((field) => field.name === name);

function classify(field: FieldLike): FieldKind {
  if (field.hasMany === true) return 'unsafe';
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'select':
    case 'radio':
      return 'string';
    case 'number':
      return 'number';
    case 'checkbox':
      return 'boolean';
    case 'date':
      return 'date';
    default:
      return 'unsafe';
  }
}

const isRequired = (field: FieldLike): boolean =>
  field.required === true || field.defaultValue !== undefined;

/**
 * Resolves a query path (`title`, `seo.title`, `author.name`, `author.id`) against the collection.
 * Groups and single relationships to exposed collections are walked; hidden, credential-like and
 * unknown fields do not resolve (`undefined`), so they can never be queried.
 */
export function resolveQueryField(
  collections: readonly CollectionLike[],
  slug: string,
  path: string,
): QueryField | undefined {
  const own = collections.find((collection) => collection.slug === slug);
  if (own === undefined || !isExposedCollection(own)) return undefined;
  const segments = path.split('.');
  let fields: readonly FieldLike[] = own.fields;
  let nullable = false;
  const payloadPath: string[] = [];

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index] as string;
    const last = index === segments.length - 1;

    if (index === 0 && last && segment === 'id') {
      return { kind: 'id', nullable: false, payloadPath: 'id' };
    }
    if (index === 0 && last && (segment === 'createdAt' || segment === 'updatedAt')) {
      return { kind: 'date', nullable: false, payloadPath: segment };
    }
    if (segment === 'id' && index > 0 && last) {
      // `author.id`: Payload's `where` addresses a relationship by the field itself.
      return { kind: 'id', nullable, payloadPath: payloadPath.join('.') };
    }

    const field = findField(fields, segment);
    if (field === undefined) return undefined;
    payloadPath.push(segment);
    if (!isRequired(field)) nullable = true;

    if (last) {
      // A relationship is queried by `author.id` or a field behind it, never as a whole.
      if (field.type === 'relationship' && field.hasMany !== true) return undefined;
      return { kind: classify(field), nullable, payloadPath: payloadPath.join('.') };
    }
    if (field.type === 'group') {
      fields = field.fields ?? [];
    } else if (field.type === 'relationship' && field.hasMany !== true) {
      const target = collections.find((collection) => collection.slug === field.relationTo);
      if (target === undefined || !isExposedCollection(target)) return undefined;
      fields = target.fields;
      nullable = true;
    } else if (field.type === 'array') {
      // Through a list: the values are many per document; leave it to the in-memory evaluation.
      return { kind: 'unsafe', nullable: true, payloadPath: payloadPath.join('.') };
    } else {
      return undefined;
    }
  }
  return undefined;
}

/** A condition compiled for Payload: always true, never true, or a `where` (`post`: a superset only). */
export type Compiled =
  | { readonly c: 'true'; readonly post: boolean }
  | { readonly c: 'false'; readonly post: false }
  | { readonly c: 'where'; readonly where: Where; readonly post: boolean };

const TRUE: Compiled = { c: 'true', post: false };
const FALSE: Compiled = { c: 'false', post: false };
/** A condition Payload cannot decide: everything passes the database, the memory pass decides. */
const SUPERSET: Compiled = { c: 'true', post: true };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
/** A date operand is safe for Payload only in the canonical form that sorts like the instant. */
const isCanonicalDate = (value: unknown): value is string =>
  typeof value === 'string' && ISO.test(value) && !Number.isNaN(Date.parse(value));

/** Whether `value` is an operand the kind can equal (typed, like the contract). */
function accepts(kind: FieldKind, value: JsonValue, id: IdType): boolean {
  switch (kind) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      return isCanonicalDate(value);
    case 'id':
      // Normalized items carry ids as strings, so only strings can equal one.
      return typeof value === 'string' && (id.kind === 'text' || /^\d+$/.test(value));
    case 'unsafe':
      return false;
  }
}

const idValue = (kind: FieldKind, value: JsonValue, id: IdType): JsonValue =>
  kind === 'id' && id.kind === 'number' && typeof value === 'string' ? Number(value) : value;

const atPath = (path: string, condition: Record<string, unknown>): Where =>
  ({ [path]: condition }) as Where;

const RANGE = {
  gt: 'greater_than',
  gte: 'greater_than_equal',
  lt: 'less_than',
  lte: 'less_than_equal',
} as const;

function compileLeaf(field: QueryField, op: string, value: JsonValue, id: IdType): Compiled {
  const { kind, payloadPath: path } = field;
  const wrap = (where: Where, post = false): Compiled => ({ c: 'where', where, post });
  const orMissing = (where: Where): Where =>
    field.nullable ? { or: [where, atPath(path, { exists: false })] } : where;

  if (kind === 'unsafe') return SUPERSET;

  switch (op) {
    case 'eq':
      return accepts(kind, value, id)
        ? wrap(atPath(path, { equals: idValue(kind, value, id) }))
        : FALSE;
    case 'neq':
      return accepts(kind, value, id)
        ? wrap(orMissing(atPath(path, { not_equals: idValue(kind, value, id) })))
        : TRUE;
    case 'in': {
      if (!Array.isArray(value)) return FALSE;
      const usable = value.filter((option) => accepts(kind, option, id));
      return usable.length === 0
        ? FALSE
        : wrap(atPath(path, { in: usable.map((option) => idValue(kind, option, id)) }));
    }
    case 'nin': {
      if (!Array.isArray(value)) return TRUE;
      const usable = value.filter((option) => accepts(kind, option, id));
      return usable.length === 0
        ? TRUE
        : wrap(
            orMissing(atPath(path, { not_in: usable.map((option) => idValue(kind, option, id)) })),
          );
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      if (kind === 'boolean' || kind === 'id') return SUPERSET;
      return accepts(kind, value, id) ? wrap(atPath(path, { [RANGE[op]]: value })) : FALSE;
    case 'exists':
      if (value !== false) return field.nullable ? wrap(atPath(path, { exists: true })) : TRUE;
      return field.nullable ? wrap(atPath(path, { exists: false })) : FALSE;
    case 'contains':
      if (kind === 'number' || kind === 'boolean') return FALSE;
      if (typeof value !== 'string') return FALSE;
      // Payload's `contains` ignores case; the contract does not, so it only narrows here.
      return kind === 'string' ? wrap(atPath(path, { contains: value }), true) : SUPERSET;
    default:
      return FALSE;
  }
}

/** Thrown for a field the site owner did not allow (or that cannot be queried at all). */
export class QueryFieldError extends Error {}

export interface WhereContext {
  readonly collections: readonly CollectionLike[];
  readonly source: string;
  readonly allowed: readonly string[];
  readonly id: IdType;
}

/** The field of a query path, or a `QueryFieldError` when it is not allowlisted or does not resolve. */
export function queryFieldOf(context: WhereContext, path: string): QueryField {
  if (!context.allowed.includes(path)) {
    throw new QueryFieldError(`The field "${path}" of "${context.source}" cannot be queried.`);
  }
  const field = resolveQueryField(context.collections, context.source, path);
  if (field === undefined) {
    throw new QueryFieldError(`The field "${path}" of "${context.source}" cannot be queried.`);
  }
  return field;
}

/** Compiles a filter tree; `false` results short-circuit, unsafe conditions widen and flag `post`. */
export function compileWhere(node: FilterNode<JsonValue>, context: WhereContext): Compiled {
  if ('and' in node) {
    const parts = node.and.map((child) => compileWhere(child, context));
    if (parts.some((part) => part.c === 'false')) return FALSE;
    const wheres = parts.flatMap((part) => (part.c === 'where' ? [part.where] : []));
    const post = parts.some((part) => part.post);
    if (wheres.length === 0) return { c: 'true', post };
    return {
      c: 'where',
      where: wheres.length === 1 ? (wheres[0] as Where) : { and: wheres },
      post,
    };
  }
  if ('or' in node) {
    const parts = node.or.map((child) => compileWhere(child, context));
    const post = parts.some((part) => part.post);
    if (parts.some((part) => part.c === 'true')) return { c: 'true', post };
    const wheres = parts.flatMap((part) => (part.c === 'where' ? [part.where] : []));
    if (wheres.length === 0) return FALSE;
    return { c: 'where', where: wheres.length === 1 ? (wheres[0] as Where) : { or: wheres }, post };
  }
  return compileLeaf(queryFieldOf(context, node.field), node.op, node.value, context.id);
}
