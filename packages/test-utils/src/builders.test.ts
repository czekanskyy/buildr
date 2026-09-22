import { checkInvariants, createSeededIdGenerator, ROOT_COMPONENT_TYPE, s } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { doc, node } from './builders.ts';

describe('node', () => {
  it('defaults type and mints an id when neither is given', () => {
    const n = node();
    expect(n.type).toBe('buildr/text');
    expect(n.id).toMatch(/^[A-Za-z0-9]{10}$/);
  });

  it('uses the given id, type, and fields verbatim', () => {
    const n = node({
      id: 'fixedid001',
      type: 'buildr/heading',
      props: { level: s(2) },
      anchor: 'h',
    });
    expect(n).toEqual({
      id: 'fixedid001',
      type: 'buildr/heading',
      props: { level: s(2) },
      anchor: 'h',
    });
  });

  it('is deterministic under a seeded generator', () => {
    const a = node({}, createSeededIdGenerator('builders-test'));
    const b = node({}, createSeededIdGenerator('builders-test'));
    expect(a.id).toBe(b.id);
  });
});

describe('doc', () => {
  it('builds a document with only a root node when given no tree', () => {
    const d = doc();
    const { root } = d.nodes;
    expect(d.schemaVersion).toBe(1);
    expect(d.root).toBe('root');
    expect(Object.keys(d.nodes)).toEqual(['root']);
    expect(root?.type).toBe(ROOT_COMPONENT_TYPE);
    expect(d.components).toEqual({ [ROOT_COMPONENT_TYPE]: 1 });
  });

  it('expands `children` sugar into slots.default, minting ids and the components map', () => {
    const d = doc({
      children: [
        { type: 'buildr/section', children: [{ type: 'buildr/heading' }, { type: 'buildr/text' }] },
      ],
    });
    const { root } = d.nodes;
    const { default: rootChildren } = root?.slots ?? {};
    const sectionId = rootChildren?.[0];
    expect(sectionId).toBeDefined();
    const section = sectionId ? d.nodes[sectionId] : undefined;
    expect(section?.type).toBe('buildr/section');
    const { default: sectionChildren } = section?.slots ?? {};
    expect(sectionChildren).toHaveLength(2);
    expect(d.components).toEqual({
      [ROOT_COMPONENT_TYPE]: 1,
      'buildr/section': 1,
      'buildr/heading': 1,
      'buildr/text': 1,
    });
    expect(checkInvariants(d)).toEqual([]);
  });

  it('honors pinned ids and named slots', () => {
    const d = doc({
      slots: {
        default: [{ id: 'sectionid1', type: 'buildr/section' }],
        aside: [{ type: 'buildr/text' }],
      },
    });
    const { sectionid1, root } = d.nodes;
    expect(sectionid1?.type).toBe('buildr/section');
    const { aside } = root?.slots ?? {};
    expect(aside).toHaveLength(1);
    expect(checkInvariants(d)).toEqual([]);
  });

  it('is deterministic under a seeded generator', () => {
    const idGen = () => createSeededIdGenerator('doc-test');
    const a = doc({ children: [{ type: 'buildr/section' }] }, { idGen: idGen() });
    const b = doc({ children: [{ type: 'buildr/section' }] }, { idGen: idGen() });
    expect(a).toEqual(b);
  });
});
