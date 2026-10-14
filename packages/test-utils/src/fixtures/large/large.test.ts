import {
  assertDocumentInvariants,
  type BuilderDocument,
  DEFAULT_DOCUMENT_LIMITS,
  parseDocument,
  parsePath,
  ROOT_COMPONENT_TYPE,
} from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { createLargeDocument } from './index.ts';

// cyrb53: a small dependency-free 53-bit string hash (test-utils has no Node types).
function hash(value: unknown): string {
  const text = JSON.stringify(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function bindingPaths(document: BuilderDocument): string[] {
  const paths: string[] = [];
  for (const node of Object.values(document.nodes)) {
    for (const value of Object.values(node.props ?? {})) {
      const v = value as { kind?: string; path?: string };
      if (v.kind === 'binding' && v.path !== undefined) paths.push(v.path);
    }
  }
  return paths;
}

// Pinned: a change here means the generator's output changed - review that on purpose.
const PINNED_HASHES: Record<number, string> = {
  1000: '14a6cb963de6e4',
  5000: '3bd6e918d2e8d',
};

describe.each([1000, 5000])('createLargeDocument({ nodes: %i })', (nodes) => {
  const document = createLargeDocument({ nodes });

  it('has exactly `nodes` nodes, the root included', () => {
    expect(Object.keys(document.nodes)).toHaveLength(nodes);
    expect(document.nodes['root']?.type).toBe(ROOT_COMPONENT_TYPE);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(JSON.stringify(createLargeDocument({ nodes }))).toBe(JSON.stringify(document));
    expect(hash(createLargeDocument({ nodes, seed: 'other' }))).not.toBe(hash(document));
  });

  it('matches the pinned hash', () => {
    expect(hash(document)).toBe(PINNED_HASHES[nodes]);
  });

  it('has binding paths that core parses', () => {
    const paths = bindingPaths(document);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(parsePath(path).ok, path).toBe(true);
  });

  it('satisfies the document invariants', () => {
    expect(() => assertDocumentInvariants(document)).not.toThrow();
  });

  it('is accepted by parseDocument with the default limits', () => {
    expect(JSON.stringify(document).length).toBeLessThan(DEFAULT_DOCUMENT_LIMITS.maxDocumentBytes);
    const parsed = parseDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed.ok).toBe(true);
  });
});

describe('createLargeDocument', () => {
  it('mixes localized values, bindings, formulas and breakpoint styles', () => {
    const json = JSON.stringify(createLargeDocument({ nodes: 1000 }));
    for (const marker of ['"l10n"', '"kind":"binding"', '"kind":"expression"', '"bp"']) {
      expect(json).toContain(marker);
    }
  });

  it('supports tiny sizes and rejects out-of-range counts', () => {
    expect(Object.keys(createLargeDocument({ nodes: 1 }).nodes)).toEqual(['root']);
    expect(Object.keys(createLargeDocument({ nodes: 7 }).nodes)).toHaveLength(7);
    expect(() => createLargeDocument({ nodes: 0 })).toThrow(RangeError);
    expect(() => createLargeDocument({ nodes: 5001 })).toThrow(RangeError);
  });
});
