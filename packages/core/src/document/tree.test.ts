import { describe, expect, it } from 'vitest';
import { createSeededIdGenerator } from '../ids/index.ts';
import type { BuilderFragment } from './fragment.ts';
import { fromTree, type TreeNode, toTree } from './tree.ts';
import type { BuilderDocument } from './types.ts';
import { ROOT_COMPONENT_TYPE } from './types.ts';

/** A document whose `.nodes` map is `nodes` — `toTree` never reads `.root`, only node lookups. */
function asDocument(nodes: BuilderDocument['nodes']): BuilderDocument {
  return { schemaVersion: 1, root: 'root', nodes, components: {} };
}

describe('fromTree', () => {
  it('mints a fresh id for every node and registers each component type at version 1', () => {
    const idGen = createSeededIdGenerator('pb-010/from-tree');
    const tree: TreeNode = {
      type: 'buildr/section',
      slots: { default: [{ type: 'buildr/heading' }, { type: 'buildr/text' }] },
    };
    const fragment = fromTree(tree, idGen);

    expect(fragment.format).toBe('buildr/fragment');
    expect(fragment.schemaVersion).toBe(1);
    expect(fragment.roots).toHaveLength(1);
    expect(Object.keys(fragment.nodes)).toHaveLength(3);
    expect(fragment.components).toEqual({
      'buildr/section': 1,
      'buildr/heading': 1,
      'buildr/text': 1,
    });

    const rootId = fragment.roots[0];
    if (!rootId) throw new Error('fixture produced no root');
    const root = fragment.nodes[rootId];
    expect(root?.type).toBe('buildr/section');
    expect(root?.slots?.default).toHaveLength(2);
  });

  it('treats children as sugar for slots.default', () => {
    const viaChildren = fromTree(
      { type: 'buildr/section', children: [{ type: 'buildr/heading' }] },
      createSeededIdGenerator('pb-010/sugar'),
    );
    const viaSlots = fromTree(
      { type: 'buildr/section', slots: { default: [{ type: 'buildr/heading' }] } },
      createSeededIdGenerator('pb-010/sugar'),
    );
    expect(viaChildren).toEqual(viaSlots);
  });

  it('defaults idGen to a real generator, minting distinct ids', () => {
    const fragment = fromTree({
      type: 'buildr/section',
      children: [{ type: 'buildr/text' }, { type: 'buildr/text' }],
    });
    expect(Object.keys(fragment.nodes)).toHaveLength(3);
    expect(new Set(Object.keys(fragment.nodes)).size).toBe(3);
  });
});

describe('toTree', () => {
  it('round-trips a tree authored with slots through fromTree', () => {
    const tree: TreeNode = {
      type: 'buildr/section',
      name: 'Hero',
      anchor: 'hero',
      props: { as: 'section' },
      slots: {
        default: [
          { type: 'buildr/heading', props: { level: 1 } },
          { type: 'buildr/text', region: 'body' },
        ],
      },
    };
    const fragment: BuilderFragment = fromTree(tree, createSeededIdGenerator('pb-010/roundtrip'));
    const rootId = fragment.roots[0];
    if (!rootId) throw new Error('fixture produced no root');

    expect(toTree(asDocument(fragment.nodes), rootId)).toEqual(tree);
  });

  it('throws for a node id that is not in the document', () => {
    const doc = asDocument({ root: { id: 'root', type: ROOT_COMPONENT_TYPE } });
    expect(() => toTree(doc, 'missing-id')).toThrow(/no node with id/);
  });

  it('skips a dangling slot child rather than throwing', () => {
    const doc = asDocument({
      root: { id: 'root', type: ROOT_COMPONENT_TYPE, slots: { default: ['missing-child'] } },
    });
    expect(toTree(doc, 'root')).toEqual({ type: ROOT_COMPONENT_TYPE, slots: { default: [] } });
  });

  it('drops fields that are not part of the authoring format', () => {
    const doc = asDocument({
      root: {
        id: 'root',
        type: ROOT_COMPONENT_TYPE,
        visibleIf: { kind: 'static', value: true },
        source: { template: 'buildr/hero', version: 1 },
        ext: { 'acme:foo': 1 },
      },
    });
    expect(toTree(doc, 'root')).toEqual({ type: ROOT_COMPONENT_TYPE });
  });
});
