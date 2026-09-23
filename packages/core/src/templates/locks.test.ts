import { describe, expect, it } from 'vitest';
import { createIndex } from '../document/document-index.ts';
import type { BuilderDocument } from '../document/types.ts';
import { findLockRoot, isInsideRegion } from './locks.ts';

/**
 * `root -> section (lock.structure) -> stack (region "actions") -> button`, plus a plain
 * `paragraph` sibling of `stack` with no region — mirrors the Hero example from
 * docs/templates.md#locks-and-regions.
 */
function doc(): BuilderDocument {
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: ['section'] } },
      section: {
        id: 'section',
        type: 'buildr/section',
        lock: { structure: true },
        slots: { default: ['stack', 'paragraph'] },
      },
      stack: {
        id: 'stack',
        type: 'buildr/stack',
        region: 'actions',
        slots: { default: ['button'] },
      },
      button: { id: 'button', type: 'buildr/button' },
      paragraph: { id: 'paragraph', type: 'buildr/text' },
    },
    components: {},
  };
}

describe('findLockRoot', () => {
  it('finds the nearest ancestor (inclusive) with lock.structure', () => {
    const document = doc();
    const index = createIndex(document);

    expect(findLockRoot(document, index, 'section')).toBe('section');
    expect(findLockRoot(document, index, 'stack')).toBe('section');
    expect(findLockRoot(document, index, 'button')).toBe('section');
  });

  it('returns undefined when no ancestor is structurally locked', () => {
    const document = doc();
    const index = createIndex(document);

    expect(findLockRoot(document, index, 'root')).toBeUndefined();
  });
});

describe('isInsideRegion', () => {
  it('is true for a node under a region marker inside the locked subtree', () => {
    const document = doc();
    const index = createIndex(document);

    expect(isInsideRegion(document, index, 'stack')).toBe(true);
    expect(isInsideRegion(document, index, 'button')).toBe(true);
  });

  it('is false for a node in the locked subtree but outside any region', () => {
    const document = doc();
    const index = createIndex(document);

    expect(isInsideRegion(document, index, 'section')).toBe(false);
    expect(isInsideRegion(document, index, 'paragraph')).toBe(false);
  });

  it('is false when the node is not inside a structurally locked subtree at all', () => {
    const document = doc();
    const index = createIndex(document);

    expect(isInsideRegion(document, index, 'root')).toBe(false);
  });
});
