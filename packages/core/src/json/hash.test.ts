import { describe, expect, it } from 'vitest';
import { hash } from './hash.ts';

describe('hash', () => {
  it('is a snapshot-stable digest of a JSON value', () => {
    expect(hash({ a: 1, b: [true, null, 'x'] })).toMatchSnapshot();
  });

  it('is a snapshot-stable digest of a primitive', () => {
    expect(hash('buildr')).toMatchSnapshot();
  });

  it('is independent of key order (same underlying value)', () => {
    expect(hash({ a: 1, b: 2 })).toBe(hash({ b: 2, a: 1 }));
  });

  it('differs for different values', () => {
    expect(hash({ a: 1 })).not.toBe(hash({ a: 2 }));
  });

  it('is a lowercase base36 string', () => {
    expect(hash('x')).toMatch(/^[0-9a-z]+$/);
  });
});
