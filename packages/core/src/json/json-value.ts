export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * A structural type guard for `JsonValue`. Tolerant of shared (DAG) references, but rejects
 * true cycles instead of recursing forever.
 */
export function isJsonValue(value: unknown): value is JsonValue {
  return check(value, new Set());
}

function check(value: unknown, ancestors: Set<unknown>): boolean {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return true;
  if (type === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    if (ancestors.has(value)) return false;
    ancestors.add(value);
    const result = value.every((item) => check(item, ancestors));
    ancestors.delete(value);
    return result;
  }
  if (type === 'object') {
    if (ancestors.has(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    ancestors.add(value);
    const result = Object.values(value as Record<string, unknown>).every((item) =>
      check(item, ancestors),
    );
    ancestors.delete(value);
    return result;
  }
  return false;
}
