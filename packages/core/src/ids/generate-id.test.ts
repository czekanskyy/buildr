import { describe, expect, it } from 'vitest';
import { generateId } from './generate-id.ts';

const ID_PATTERN = /^[0-9A-Za-z]{10}$/;

describe('generateId', () => {
  it('returns a 10-character base62 string', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateId()).toMatch(ID_PATTERN);
    }
  });

  it('produces no collisions across 1e6 generated IDs', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1_000_000; i++) {
      const id = generateId();
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  }, 30_000);
});
