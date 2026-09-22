import { describe, expect, it } from 'vitest';
import { createSeededIdGenerator } from './seeded-id-generator.ts';

const ID_PATTERN = /^[0-9A-Za-z]{10}$/;

describe('createSeededIdGenerator', () => {
  it('returns 10-character base62 IDs', () => {
    const gen = createSeededIdGenerator('shape');
    expect(gen()).toMatch(ID_PATTERN);
  });

  it('is deterministic for a numeric seed', () => {
    const idsA = Array.from({ length: 50 }, createSeededIdGenerator(42));
    const idsB = Array.from({ length: 50 }, createSeededIdGenerator(42));
    expect(idsA).toEqual(idsB);
  });

  it('is deterministic for a string seed', () => {
    const a = createSeededIdGenerator('fixture-seed');
    const b = createSeededIdGenerator('fixture-seed');
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededIdGenerator(1);
    const b = createSeededIdGenerator(2);
    expect(a()).not.toBe(b());
  });

  it('advances its state between calls instead of repeating the same ID', () => {
    const gen = createSeededIdGenerator('advance');
    const first = gen();
    const second = gen();
    expect(first).not.toBe(second);
  });

  it('never collides across 1e5 IDs drawn from a single seeded generator', () => {
    const gen = createSeededIdGenerator('collision-check');
    const seen = new Set<string>();
    for (let i = 0; i < 100_000; i++) {
      const id = gen();
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
});
