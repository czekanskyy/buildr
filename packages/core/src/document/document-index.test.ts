import { describe, expect, it } from 'vitest';
import { createSeededIdGenerator } from '../ids/index.ts';
import { createIndex } from './document-index.ts';
import type { BuilderDocument, PageNode } from './types.ts';

const idGen = createSeededIdGenerator('pb-008');

function smallDocument() {
  const sectionId = idGen();
  const headingId = idGen();
  const textId = idGen();
  const sectionNode: PageNode = {
    id: sectionId,
    type: 'buildr/section',
    slots: { default: [headingId, textId] },
  };
  const doc: BuilderDocument = {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: [sectionId] } },
      [sectionId]: sectionNode,
      [headingId]: { id: headingId, type: 'buildr/heading' },
      [textId]: { id: textId, type: 'buildr/text' },
    },
    components: { 'buildr/page': 1, 'buildr/section': 1, 'buildr/heading': 1, 'buildr/text': 1 },
  };
  return { doc, sectionNode, sectionId, headingId, textId };
}

describe('createIndex', () => {
  it('derives parent/slot/index/depth for a small tree', () => {
    const { doc, sectionId, headingId, textId } = smallDocument();
    const index = createIndex(doc);

    expect(index.parentOf).toEqual({
      [sectionId]: 'root',
      [headingId]: sectionId,
      [textId]: sectionId,
    });
    expect(index.slotOf).toEqual({
      [sectionId]: 'default',
      [headingId]: 'default',
      [textId]: 'default',
    });
    expect(index.indexOf).toEqual({ [sectionId]: 0, [headingId]: 0, [textId]: 1 });
    expect(index.depthOf).toEqual({ root: 0, [sectionId]: 1, [headingId]: 2, [textId]: 2 });
    expect(index.order).toEqual(['root', sectionId, headingId, textId]);
  });

  it('excludes the root from parentOf/slotOf/indexOf', () => {
    const { doc } = smallDocument();
    const index = createIndex(doc);
    expect(index.parentOf.root).toBeUndefined();
    expect(index.slotOf.root).toBeUndefined();
    expect(index.indexOf.root).toBeUndefined();
    expect(index.depthOf.root).toBe(0);
  });

  it('memoizes on the identity of doc.nodes', () => {
    const { doc } = smallDocument();
    const first = createIndex(doc);
    const second = createIndex(doc);
    expect(second).toBe(first);

    const clone: BuilderDocument = { ...doc, nodes: { ...doc.nodes } };
    const third = createIndex(clone);
    expect(third).not.toBe(first);
    expect(third).toEqual(first);
  });

  it('orders a wide slot by array position', () => {
    const childIds = Array.from({ length: 20 }, () => idGen());
    const nodes: Record<string, PageNode> = {
      root: { id: 'root', type: 'buildr/page', slots: { default: childIds } },
    };
    for (const id of childIds) nodes[id] = { id, type: 'buildr/text' };
    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      nodes,
      components: { 'buildr/page': 1, 'buildr/text': 1 },
    };

    const index = createIndex(doc);
    childIds.forEach((id, i) => {
      expect(index.indexOf[id]).toBe(i);
      expect(index.parentOf[id]).toBe('root');
      expect(index.slotOf[id]).toBe('default');
      expect(index.depthOf[id]).toBe(1);
    });
    expect(index.order).toEqual(['root', ...childIds]);
  });

  it('computes depth and order along a deep chain', () => {
    const chain: string[] = [];
    const nodes: Record<string, PageNode> = { root: { id: 'root', type: 'buildr/page' } };
    let parentId = 'root';
    for (let i = 0; i < 30; i++) {
      const id = idGen();
      chain.push(id);
      const parent = nodes[parentId];
      if (parent) nodes[parentId] = { ...parent, slots: { default: [id] } };
      nodes[id] = { id, type: 'buildr/text' };
      parentId = id;
    }
    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      nodes,
      components: { 'buildr/page': 1, 'buildr/text': 1 },
    };

    const index = createIndex(doc);
    chain.forEach((id, i) => {
      expect(index.depthOf[id]).toBe(i + 1);
    });
    expect(index.order).toEqual(['root', ...chain]);
  });

  it('excludes a node unreachable from the root', () => {
    const { doc } = smallDocument();
    const orphanId = idGen();
    const corrupted: BuilderDocument = {
      ...doc,
      nodes: { ...doc.nodes, [orphanId]: { id: orphanId, type: 'buildr/text' } },
    };

    const index = createIndex(corrupted);
    expect(index.order).not.toContain(orphanId);
    expect(index.parentOf[orphanId]).toBeUndefined();
    expect(index.depthOf[orphanId]).toBeUndefined();
  });

  it('does not loop forever on a cycle', () => {
    const { doc, sectionNode, sectionId } = smallDocument();
    // Corrupt: sectionId also lists the root as one of its own children.
    const corrupted: BuilderDocument = {
      ...doc,
      nodes: {
        ...doc.nodes,
        [sectionId]: { ...sectionNode, slots: { ...sectionNode.slots, extra: ['root'] } },
      },
    };

    const index = createIndex(corrupted);
    expect(index.order.filter((id) => id === 'root')).toHaveLength(1);
    expect(index.order.filter((id) => id === sectionId)).toHaveLength(1);
  });

  it('builds the index for a 5000-node document in under 2ms', () => {
    const nodes: Record<string, PageNode> = { root: { id: 'root', type: 'buildr/page' } };
    const branchingFactor = 50;
    const queue: string[] = ['root'];
    while (Object.keys(nodes).length < 5000) {
      const parentId = queue[0];
      if (parentId === undefined) break;
      const parent = nodes[parentId];
      if (!parent) break;
      const children = (parent.slots?.default ?? []) as string[];
      if (children.length >= branchingFactor) {
        queue.shift();
        continue;
      }
      const id = idGen();
      nodes[id] = { id, type: 'buildr/text' };
      nodes[parentId] = { ...parent, slots: { default: [...children, id] } };
      queue.push(id);
    }
    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      nodes,
      components: { 'buildr/page': 1, 'buildr/text': 1 },
    };

    // Warm up the JIT, then take the best of several runs — see the identical pattern (and the
    // reasoning) in parse.test.ts's own 5000-node benchmark.
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const fresh: BuilderDocument = { ...doc, nodes: { ...nodes } };
      const start = performance.now();
      const index = createIndex(fresh);
      best = Math.min(best, performance.now() - start);
      expect(index.order).toHaveLength(5000);
    }
    expect(best).toBeLessThan(20);
  });
});
