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

  it('exports the PB-007 document primitives', () => {
    expect(typeof core.createEmptyDocument).toBe('function');
    expect(typeof core.parseDocument).toBe('function');
    expect(typeof core.documentSchema.safeParse).toBe('function');
    expect(typeof core.pageNodeSchema.safeParse).toBe('function');
    expect(core.DEFAULT_DOCUMENT_LIMITS.maxNodes).toBe(5000);
    expect(core.ROOT_COMPONENT_TYPE).toBe('buildr/page');
  });

  it('exports the PB-008 document index and traversal primitives', () => {
    expect(typeof core.createIndex).toBe('function');
    expect(typeof core.walk).toBe('function');
    expect(typeof core.ancestors).toBe('function');
    expect(typeof core.descendants).toBe('function');
    expect(typeof core.subtreeIds).toBe('function');
    expect(typeof core.isAncestor).toBe('function');
    expect(typeof core.pathTo).toBe('function');
  });
});
