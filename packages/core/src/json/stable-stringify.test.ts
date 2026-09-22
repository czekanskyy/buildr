import { describe, expect, it } from 'vitest';
import { stableStringify } from './stable-stringify.ts';

describe('stableStringify', () => {
  it('is independent of input key order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('sorts nested object keys too', () => {
    expect(stableStringify({ z: { d: 1, c: 2 }, a: 1 })).toBe('{"a":1,"z":{"c":2,"d":1}}');
  });

  it('preserves array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('matches JSON.stringify for primitives', () => {
    expect(stableStringify('a')).toBe('"a"');
    expect(stableStringify(1)).toBe('1');
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify(null)).toBe('null');
  });

  it('handles an empty array and an empty object', () => {
    expect(stableStringify([])).toBe('[]');
    expect(stableStringify({})).toBe('{}');
  });

  it('round-trips through JSON.parse to an equivalent value', () => {
    const value = { b: [1, { d: 4, c: 3 }], a: 'x' };
    expect(JSON.parse(stableStringify(value))).toEqual(value);
  });
});
