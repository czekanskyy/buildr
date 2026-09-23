import { z } from 'zod';
import { type DataField, type DataType, dataFieldSchema } from '../schema/data-type.ts';
import { MAX_PATH_DEPTH, parsePath } from './path.ts';

/**
 * The statically-known shape of a document's data (docs/dynamic-bindings.md#data-types-and-the-
 * data-schema). `scopes` are the top-level names a binding path can start with (`site`, `page` |
 * `post` | `product`, `route`, and, inside a Loop, `item`/`index`/`loop`); `entities` are shared
 * types (`author`, `category`, `media`) that a `{ t: 'ref' }` field points into. An adapter (e.g.
 * Payload) derives this from its own collection config; the playground builds one by hand.
 */
export interface DataSchema {
  readonly scopes: Readonly<Record<string, DataField>>;
  readonly entities: Readonly<Record<string, DataField>>;
}

export const dataSchemaSchema: z.ZodType<DataSchema> = z.strictObject({
  scopes: z.record(z.string(), dataFieldSchema),
  entities: z.record(z.string(), dataFieldSchema),
});

/**
 * Follows a `{ t: 'ref' }` field to the `DataField` it points at in `schema.entities`, repeating
 * until a non-`ref` field is reached. Returns `undefined` for a ref to an unknown entity or a
 * cycle (`author` -> `author`, or a longer loop) — a malformed/self-referential schema is bad
 * data, not a programmer error, so this never throws.
 */
function resolveRef(field: DataField, schema: DataSchema): DataField | undefined {
  let current = field;
  const seen = new Set<string>();
  while (current.type.t === 'ref') {
    if (seen.has(current.type.entity)) return undefined;
    seen.add(current.type.entity);
    const next = schema.entities[current.type.entity];
    if (next === undefined) return undefined;
    current = next;
  }
  return current;
}

/**
 * The `DataField` a binding path resolves to under `schema`, or `undefined` when the path is
 * syntactically invalid or doesn't exist in the schema (docs/dynamic-bindings.md#data-types-and-
 * the-data-schema) — used for editor-time validation (a red "field does not exist" chip) and by
 * the future expression typechecker (PB-024). A `[n]` step only matches a `list` field (any index
 * maps to the same `list.of` element type, since a static schema can't know how long the list
 * actually is at runtime); a `ref` step is transparently followed before the next segment is read.
 */
export function schemaAtPath(schema: DataSchema, path: string): DataField | undefined {
  const parsed = parsePath(path);
  if (!parsed.ok || parsed.value.length === 0) return undefined;

  const [first, ...rest] = parsed.value;
  if (first === undefined || first.kind !== 'key') return undefined;

  let current: DataField | undefined = schema.scopes[first.key];
  for (const segment of rest) {
    if (current === undefined) return undefined;
    const resolved = resolveRef(current, schema);
    if (resolved === undefined) return undefined;

    if (segment.kind === 'index') {
      current = resolved.type.t === 'list' ? { type: resolved.type.of } : undefined;
    } else {
      current = resolved.type.t === 'object' ? resolved.type.fields[segment.key] : undefined;
    }
  }

  return current === undefined ? undefined : resolveRef(current, schema);
}

/**
 * Every path in `schema` whose resolved `DataType` satisfies `filter` (all of them, when `filter`
 * is omitted) — feeds the editor's `DataSchema` tree, filtered to the types a given prop accepts
 * (docs/dynamic-bindings.md#editor-ui). Descends into `object` fields; a `list` field is included
 * itself but not descended into, since `list.of` describes an average element's shape, not an
 * addressable static path — a Loop instead introduces a runtime `item` scope with that shape
 * (docs/dynamic-bindings.md#lists-and-queries-loop-query). Recursion is capped at
 * `MAX_PATH_DEPTH`, which also protects against a schema with a ref cycle reachable through
 * `object` fields (e.g. `category.parent` pointing back to the `category` entity) rather than
 * directly.
 */
export function listPaths(
  schema: DataSchema,
  filter?: (type: DataType) => boolean,
): readonly string[] {
  const paths: string[] = [];

  function visit(field: DataField, path: string, depth: number): void {
    if (depth > MAX_PATH_DEPTH) return;
    const resolved = resolveRef(field, schema);
    if (resolved === undefined) return;

    if (filter === undefined || filter(resolved.type)) paths.push(path);

    if (resolved.type.t === 'object') {
      for (const [key, child] of Object.entries(resolved.type.fields)) {
        visit(child, `${path}.${key}`, depth + 1);
      }
    }
  }

  for (const [name, field] of Object.entries(schema.scopes)) {
    visit(field, name, 1);
  }

  return paths;
}
