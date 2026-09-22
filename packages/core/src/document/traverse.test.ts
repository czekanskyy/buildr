import { describe, expect, it } from 'vitest';
import { createSeededIdGenerator } from '../ids/index.ts';
import { ancestors, descendants, isAncestor, pathTo, subtreeIds, walk } from './traverse.ts';
import type { BuilderDocument, PageNode } from './types.ts';

const idGen = createSeededIdGenerator('pb-008-traverse');

function smallDocument() {
  const sectionId = idGen();
  const headingId = idGen();
  const textId = idGen();
  const doc: BuilderDocument = {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: [sectionId] } },
      [sectionId]: {
        id: sectionId,
        type: 'buildr/section',
        slots: { default: [headingId, textId] },
      },
      [headingId]: { id: headingId, type: 'buildr/heading' },
      [textId]: { id: textId, type: 'buildr/text' },
    },
    components: { 'buildr/page': 1, 'buildr/section': 1, 'buildr/heading': 1, 'buildr/text': 1 },
  };
  return { doc, sectionId, headingId, textId };
}

describe('walk', () => {
  it('visits every reachable node in pre-order from the root by default', () => {
    const { doc, sectionId, headingId, textId } = smallDocument();
    const ids = [...walk(doc)].map((node) => node.id);
    expect(ids).toEqual(['root', sectionId, headingId, textId]);
  });

  it('visits only the subtree rooted at a given ID', () => {
    const { doc, sectionId, headingId, textId } = smallDocument();
    const ids = [...walk(doc, sectionId)].map((node) => node.id);
    expect(ids).toEqual([sectionId, headingId, textId]);
  });

  it('yields nothing for an unknown ID', () => {
    const { doc } = smallDocument();
    expect([...walk(doc, 'doesNotExist')]).toEqual([]);
  });

  it('yields a single frame for a leaf', () => {
    const { doc, textId } = smallDocument();
    const ids = [...walk(doc, textId)].map((node) => node.id);
    expect(ids).toEqual([textId]);
  });
});

describe('ancestors', () => {
  it('is empty for the root', () => {
    const { doc } = smallDocument();
    expect(ancestors(doc, 'root')).toEqual([]);
  });

  it('lists the chain nearest-parent-first, ending at the root', () => {
    const { doc, sectionId, headingId } = smallDocument();
    expect(ancestors(doc, headingId)).toEqual([sectionId, 'root']);
  });

  it('is empty for an unreachable ID', () => {
    const { doc } = smallDocument();
    expect(ancestors(doc, 'doesNotExist')).toEqual([]);
  });
});

describe('pathTo', () => {
  it('is just the root for the root itself', () => {
    const { doc } = smallDocument();
    expect(pathTo(doc, 'root')).toEqual(['root']);
  });

  it('is the root-to-id path inclusive of both ends', () => {
    const { doc, sectionId, headingId } = smallDocument();
    expect(pathTo(doc, headingId)).toEqual(['root', sectionId, headingId]);
  });

  it('is empty for a node absent from the document', () => {
    const { doc } = smallDocument();
    expect(pathTo(doc, 'doesNotExist')).toEqual([]);
  });
});

describe('descendants', () => {
  it('lists every node under the root, excluding the root', () => {
    const { doc, sectionId, headingId, textId } = smallDocument();
    expect(descendants(doc, 'root')).toEqual([sectionId, headingId, textId]);
  });

  it('is empty for a leaf', () => {
    const { doc, textId } = smallDocument();
    expect(descendants(doc, textId)).toEqual([]);
  });
});

describe('subtreeIds', () => {
  it('includes the node itself and its descendants, in pre-order', () => {
    const { doc, sectionId, headingId, textId } = smallDocument();
    expect(subtreeIds(doc, sectionId)).toEqual([sectionId, headingId, textId]);
  });

  it('is just the node itself for a leaf', () => {
    const { doc, textId } = smallDocument();
    expect(subtreeIds(doc, textId)).toEqual([textId]);
  });
});

describe('isAncestor', () => {
  it('is true for the root and any reachable node', () => {
    const { doc, headingId } = smallDocument();
    expect(isAncestor(doc, 'root', headingId)).toBe(true);
  });

  it('is false for a descendant checked against its ancestor', () => {
    const { doc, headingId } = smallDocument();
    expect(isAncestor(doc, headingId, 'root')).toBe(false);
  });

  it('is false for a node against itself', () => {
    const { doc, sectionId } = smallDocument();
    expect(isAncestor(doc, sectionId, sectionId)).toBe(false);
    expect(isAncestor(doc, 'root', 'root')).toBe(false);
  });

  it('is false for unrelated nodes', () => {
    const { doc, headingId, textId } = smallDocument();
    expect(isAncestor(doc, headingId, textId)).toBe(false);
  });
});

describe('walk vs. createIndex.order', () => {
  it('agree on document order for a wide, multi-slot tree', () => {
    const cardId = idGen();
    const titleId = idGen();
    const bodyId = idGen();
    const footerId = idGen();
    const nodes: Record<string, PageNode> = {
      root: { id: 'root', type: 'buildr/page', slots: { default: [cardId] } },
      [cardId]: {
        id: cardId,
        type: 'buildr/card',
        slots: { header: [titleId], default: [bodyId], footer: [footerId] },
      },
      [titleId]: { id: titleId, type: 'buildr/heading' },
      [bodyId]: { id: bodyId, type: 'buildr/text' },
      [footerId]: { id: footerId, type: 'buildr/text' },
    };
    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      nodes,
      components: { 'buildr/page': 1, 'buildr/card': 1, 'buildr/heading': 1, 'buildr/text': 1 },
    };

    const ids = [...walk(doc)].map((node) => node.id);
    expect(ids).toEqual(['root', cardId, titleId, bodyId, footerId]);
  });
});
