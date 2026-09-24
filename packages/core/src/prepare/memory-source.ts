import { getPath, parsePath } from '../data/path.ts';
import type { FilterNode, ResolvedQuerySpec } from '../data/query-spec.ts';
import type { DataSource, MediaAsset, QueryResult } from '../data/source.ts';
import { jsonEquals } from '../expressions/stdlib/list.ts';
import type { JsonValue } from '../json/json-value.ts';

export interface MemoryDataSourceInput {
  /** Items per collection alias. An alias that is not a key here is not allowed. */
  readonly collections?: Readonly<Record<string, readonly JsonValue[]>>;
  /** Media by id. */
  readonly media?: Readonly<Record<string, MediaAsset>>;
}

type Item = Readonly<Record<string, JsonValue>>;

function isItem(value: JsonValue): value is Item {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The value at `field` (`author.name`), or `undefined` when absent. Only own properties are read. */
function fieldOf(item: JsonValue, field: string): JsonValue | undefined {
  return isItem(item) ? getPath(item, field) : undefined;
}

function compare(a: JsonValue, b: JsonValue): number | undefined {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return undefined;
}

function matches(item: JsonValue, filter: FilterNode<JsonValue>): boolean {
  if ('and' in filter) return filter.and.every((child) => matches(item, child));
  if ('or' in filter) return filter.or.some((child) => matches(item, child));

  const actual = fieldOf(item, filter.field);
  const operand = filter.value;
  switch (filter.op) {
    case 'exists':
      return (actual !== undefined && actual !== null) === (operand !== false);
    case 'eq':
      return actual !== undefined && jsonEquals(actual, operand);
    case 'neq':
      return actual === undefined || !jsonEquals(actual, operand);
    case 'in':
      return (
        actual !== undefined &&
        Array.isArray(operand) &&
        operand.some((option) => jsonEquals(actual, option))
      );
    case 'nin':
      return (
        actual === undefined ||
        !Array.isArray(operand) ||
        !operand.some((option) => jsonEquals(actual, option))
      );
    case 'contains':
      if (typeof actual === 'string')
        return typeof operand === 'string' && actual.includes(operand);
      return Array.isArray(actual) && actual.some((element) => jsonEquals(element, operand));
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (actual === undefined) return false;
      const order = compare(actual, operand);
      if (order === undefined) return false;
      if (filter.op === 'gt') return order > 0;
      if (filter.op === 'gte') return order >= 0;
      return filter.op === 'lt' ? order < 0 : order <= 0;
    }
  }
}

function sorted(items: readonly JsonValue[], sort: ResolvedQuerySpec['sort']): JsonValue[] {
  const list = [...items];
  if (sort === undefined || sort.length === 0) return list;
  // Array#sort is stable, so ties keep the collection's own order.
  return list.sort((a, b) => {
    for (const { field, dir } of sort) {
      const left = fieldOf(a, field) ?? null;
      const right = fieldOf(b, field) ?? null;
      // Missing values sort last in both directions.
      if (left === null || right === null) {
        if (left === right) continue;
        return left === null ? 1 : -1;
      }
      const order = compare(left, right) ?? 0;
      if (order !== 0) return dir === 'asc' ? order : -order;
    }
    return 0;
  });
}

/**
 * An in-memory `DataSource` for the playground and tests (ADR-018). It is the reference for the
 * operator semantics every other implementation must match (see the shared contract suite in
 * `@buildr/test-utils`): comparisons are strict and typed, a missing field never satisfies
 * `eq`/`in`/`gt..lte`/`contains` but does satisfy `neq`/`nin`, missing values sort last, and text
 * ordering is by UTF-16 code unit.
 */
export function createMemoryDataSource(input: MemoryDataSourceInput = {}): DataSource {
  const collections = input.collections ?? {};
  const media = input.media ?? {};

  return {
    getMedia(ids) {
      const found: Record<string, MediaAsset> = {};
      for (const id of ids) {
        if (Object.hasOwn(media, id)) found[id] = cloneJson(media[id] as MediaAsset);
      }
      return Promise.resolve(found);
    },

    query(spec) {
      if (!Object.hasOwn(collections, spec.source)) {
        return Promise.reject(new Error(`unknown collection "${spec.source}"`));
      }
      for (const key of [...(spec.sort ?? []).map((s) => s.field), ...fieldsOf(spec.where)]) {
        if (!parsePath(key).ok) {
          return Promise.reject(new Error(`invalid field "${key}"`));
        }
      }

      let items = collections[spec.source] as readonly JsonValue[];
      if (spec.excludeId !== undefined) {
        const excluded = String(spec.excludeId);
        items = items.filter((item) => {
          const id = fieldOf(item, 'id');
          return id === undefined || String(id) !== excluded;
        });
      }
      if (spec.where !== undefined) {
        const where = spec.where;
        items = items.filter((item) => matches(item, where));
      }
      const ordered = sorted(items, spec.sort);
      const total = ordered.length;
      const start = (spec.page - 1) * spec.limit;
      const result: QueryResult = {
        // Copies, so a caller can never reach back into the store.
        items: cloneJson(ordered.slice(start, start + spec.limit)),
        total,
        page: spec.page,
        totalPages: Math.ceil(total / spec.limit),
      };
      return Promise.resolve(result);
    },
  };
}

function fieldsOf(filter: FilterNode<JsonValue> | undefined): string[] {
  if (filter === undefined) return [];
  if ('and' in filter) return filter.and.flatMap(fieldsOf);
  if ('or' in filter) return filter.or.flatMap(fieldsOf);
  return [filter.field];
}

/** A deep copy of JSON data (everything a `DataSource` holds is JSON). */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
