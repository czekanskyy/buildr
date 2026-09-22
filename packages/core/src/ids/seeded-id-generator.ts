import { idFromRandomBytes } from './alphabet.ts';
import type { IdGenerator } from './generate-id.ts';

// mulberry32: small, fast, deterministic - good enough for reproducible test fixtures, not a
// cryptographic PRNG.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a, 32-bit: spreads a string seed across the PRNG's state space.
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A deterministic `IdGenerator`: the same seed always produces the same ID sequence, for
 * reproducible test fixtures (see docs/ai/testing-rules.md).
 */
export function createSeededIdGenerator(seed: number | string): IdGenerator {
  const next = mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed);
  return () =>
    idFromRandomBytes((size) => {
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        bytes[i] = Math.floor(next() * 256);
      }
      return bytes;
    });
}
