import { describe, expect, it } from 'vitest';
import { isJsonValue } from './json-value.ts';

describe('isJsonValue', () => {
  it('accepts primitives', () => {
    expect(isJsonValue('a')).toBe(true);
    expect(isJsonValue(1)).toBe(true);
    expect(isJsonValue(true)).toBe(true);
    expect(isJsonValue(false)).toBe(true);
    expect(isJsonValue(null)).toBe(true);
  });

  it('rejects non-finite numbers', () => {
    expect(isJsonValue(Number.NaN)).toBe(false);
    expect(isJsonValue(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isJsonValue(Number.NEGATIVE_INFINITY)).toBe(false);
  });

  it('rejects undefined, functions and symbols', () => {
    expect(isJsonValue(undefined)).toBe(false);
    expect(
      isJsonValue(() => {
        /* noop */
      }),
    ).toBe(false);
    expect(isJsonValue(Symbol('s'))).toBe(false);
  });

  it('accepts nested arrays and plain objects', () => {
    expect(isJsonValue({ a: [1, 'b', { c: null }] })).toBe(true);
  });

  it('accepts an empty array and an empty object', () => {
    expect(isJsonValue([])).toBe(true);
    expect(isJsonValue({})).toBe(true);
  });

  it('accepts objects with a null prototype', () => {
    expect(isJsonValue(Object.create(null))).toBe(true);
  });

  it('rejects class instances, Date, Map and Set', () => {
    expect(isJsonValue(new Date())).toBe(false);
    expect(isJsonValue(new Map())).toBe(false);
    expect(isJsonValue(new Set())).toBe(false);
    class Foo {}
    expect(isJsonValue(new Foo())).toBe(false);
  });

  it('rejects an object with an undefined-valued property', () => {
    expect(isJsonValue({ a: undefined })).toBe(false);
  });

  it('rejects an array containing an invalid item', () => {
    expect(isJsonValue([1, undefined])).toBe(false);
  });

  it('accepts a DAG where the same object is referenced twice (not a cycle)', () => {
    const shared = { x: 1 };
    expect(isJsonValue({ a: shared, b: shared })).toBe(true);
  });

  it('rejects cyclic objects instead of recursing forever', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(isJsonValue(cyclic)).toBe(false);
  });

  it('rejects cyclic arrays instead of recursing forever', () => {
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(isJsonValue(cyclic)).toBe(false);
  });
});
