import { describe, expect, it } from 'vitest';
import * as core from './index.ts';

describe('@buildr/core public API', () => {
  it('exports the PB-006 primitives', () => {
    expect(typeof core.generateId).toBe('function');
    expect(typeof core.createSeededIdGenerator).toBe('function');
    expect(typeof core.isJsonValue).toBe('function');
    expect(typeof core.stableStringify).toBe('function');
    expect(typeof core.hash).toBe('function');
    expect(typeof core.ok).toBe('function');
    expect(typeof core.err).toBe('function');
  });
});
