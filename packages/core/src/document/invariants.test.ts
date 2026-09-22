import { describe, expect, it } from 'vitest';
import { createSeededIdGenerator } from '../ids/index.ts';
import { createEmptyDocument } from './create.ts';
import { assertDocumentInvariants, checkInvariants } from './invariants.ts';
import type { BuilderDocument } from './types.ts';

const idGen = createSeededIdGenerator('pb-009');

function codesOf(doc: BuilderDocument): string[] {
  return checkInvariants(doc).map((d) => d.code);
}

function smallValidDocument(): BuilderDocument {
  const sectionId = idGen();
  const headingId = idGen();
  const textId = idGen();
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: [sectionId] } },
      [sectionId]: {
        id: sectionId,
        type: 'buildr/section',
        anchor: 'hero',
        slots: { default: [headingId, textId] },
      },
      [headingId]: { id: headingId, type: 'buildr/heading' },
      [textId]: { id: textId, type: 'buildr/text', anchor: 'intro' },
    },
    components: { 'buildr/page': 1, 'buildr/section': 1, 'buildr/heading': 1, 'buildr/text': 1 },
  };
}

describe('checkInvariants', () => {
  it('reports nothing for the empty document', () => {
    expect(checkInvariants(createEmptyDocument())).toEqual([]);
  });

  it('reports nothing for a valid, richer document', () => {
    expect(checkInvariants(smallValidDocument())).toEqual([]);
  });

  it('reports document.root-missing when the root key has no node', () => {
    const { root: _root, ...rest } = smallValidDocument().nodes;
    const doc: BuilderDocument = { ...smallValidDocument(), nodes: rest };
    expect(codesOf(doc)).toEqual(['document.root-missing']);
  });

  it('reports document.root-wrong-type when the root node has the wrong type', () => {
    const doc = smallValidDocument();
    const root = doc.nodes.root;
    if (!root) throw new Error('fixture missing a root node');
    const corrupted: BuilderDocument = {
      ...doc,
      nodes: { ...doc.nodes, root: { ...root, type: 'buildr/section' } },
    };
    expect(codesOf(corrupted)).toEqual(['document.root-wrong-type']);
  });

  it('reports document.node-id-mismatch when a map key does not match its node id', () => {
    // The node is correctly reachable under `mapKey` — only its own `id` field lies.
    const mapKey = idGen();
    const wrongId = idGen();
    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      nodes: {
        root: { id: 'root', type: 'buildr/page', slots: { default: [mapKey] } },
        [mapKey]: { id: wrongId, type: 'buildr/text' },
      },
      components: { 'buildr/page': 1, 'buildr/text': 1 },
    };
    expect(codesOf(doc)).toEqual(['document.node-id-mismatch']);
  });

  it('reports document.root-referenced-as-child when a slot lists "root"', () => {
    const doc = smallValidDocument();
    const sectionId = doc.nodes.root?.slots?.default?.[0];
    if (!sectionId) throw new Error('fixture missing a section id');
    const section = doc.nodes[sectionId];
    if (!section) throw new Error('fixture missing a section node');
    const corrupted: BuilderDocument = {
      ...doc,
      nodes: {
        ...doc.nodes,
        [sectionId]: { ...section, slots: { ...section.slots, extra: ['root'] } },
      },
    };
    expect(codesOf(corrupted)).toContain('document.root-referenced-as-child');
  });

  it('reports document.dangling-child when a slot references a missing node', () => {
    const doc = smallValidDocument();
    const root = doc.nodes.root;
    if (!root) throw new Error('fixture missing a root node');
    const missingId = idGen();
    const corrupted: BuilderDocument = {
      ...doc,
      nodes: {
        ...doc.nodes,
        root: { ...root, slots: { ...root.slots, extra: [missingId] } },
      },
    };
    expect(codesOf(corrupted)).toEqual(['document.dangling-child']);
  });

  it('reports document.multiple-parents when a node is referenced from two slots', () => {
    const doc = smallValidDocument();
    const headingId = Object.keys(doc.nodes).find((id) => doc.nodes[id]?.type === 'buildr/heading');
    const sectionId = doc.nodes.root?.slots?.default?.[0];
    if (!headingId || !sectionId) throw new Error('fixture missing expected nodes');
    const section = doc.nodes[sectionId];
    if (!section) throw new Error('fixture missing a section node');
    const corrupted: BuilderDocument = {
      ...doc,
      nodes: {
        ...doc.nodes,
        [sectionId]: { ...section, slots: { ...section.slots, extra: [headingId] } },
      },
    };
    expect(codesOf(corrupted)).toEqual(['document.multiple-parents']);
  });

  it('reports document.orphan-node for a node unreachable from the root', () => {
    const doc = smallValidDocument();
    const orphanId = idGen();
    const corrupted: BuilderDocument = {
      ...doc,
      nodes: { ...doc.nodes, [orphanId]: { id: orphanId, type: 'buildr/text' } },
    };
    expect(codesOf(corrupted)).toEqual(['document.orphan-node']);
  });

  it('reports document.orphan-node for every node in an unreachable subtree', () => {
    const doc = smallValidDocument();
    const parentId = idGen();
    const childId = idGen();
    const corrupted: BuilderDocument = {
      ...doc,
      nodes: {
        ...doc.nodes,
        [parentId]: { id: parentId, type: 'buildr/section', slots: { default: [childId] } },
        [childId]: { id: childId, type: 'buildr/text' },
      },
    };
    expect(codesOf(corrupted)).toEqual(['document.orphan-node', 'document.orphan-node']);
  });

  it('reports document.cycle for a node that lists itself as its own child', () => {
    const selfId = idGen();
    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      nodes: {
        root: { id: 'root', type: 'buildr/page' },
        [selfId]: { id: selfId, type: 'buildr/section', slots: { default: [selfId] } },
      },
      components: { 'buildr/page': 1, 'buildr/section': 1 },
    };
    expect(codesOf(doc)).toEqual(['document.cycle']);
  });

  it('reports document.cycle for a two-node ring unreachable from the root', () => {
    const aId = idGen();
    const bId = idGen();
    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      nodes: {
        root: { id: 'root', type: 'buildr/page' },
        [aId]: { id: aId, type: 'buildr/section', slots: { default: [bId] } },
        [bId]: { id: bId, type: 'buildr/section', slots: { default: [aId] } },
      },
      components: { 'buildr/page': 1, 'buildr/section': 1 },
    };
    const codes = codesOf(doc);
    expect(codes).toEqual(['document.cycle', 'document.cycle']);
  });

  it('reports document.cycle for a three-node ring unreachable from the root', () => {
    const aId = idGen();
    const bId = idGen();
    const cId = idGen();
    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      nodes: {
        root: { id: 'root', type: 'buildr/page' },
        [aId]: { id: aId, type: 'buildr/section', slots: { default: [bId] } },
        [bId]: { id: bId, type: 'buildr/section', slots: { default: [cId] } },
        [cId]: { id: cId, type: 'buildr/section', slots: { default: [aId] } },
      },
      components: { 'buildr/page': 1, 'buildr/section': 1 },
    };
    expect(codesOf(doc)).toEqual(['document.cycle', 'document.cycle', 'document.cycle']);
  });

  it('reports document.duplicate-anchor when two nodes share an anchor', () => {
    const doc = smallValidDocument();
    const headingId = Object.keys(doc.nodes).find((id) => doc.nodes[id]?.type === 'buildr/heading');
    if (!headingId) throw new Error('fixture missing a heading node');
    const heading = doc.nodes[headingId];
    if (!heading) throw new Error('fixture missing a heading node');
    const corrupted: BuilderDocument = {
      ...doc,
      nodes: { ...doc.nodes, [headingId]: { ...heading, anchor: 'intro' } },
    };
    expect(codesOf(corrupted)).toEqual(['document.duplicate-anchor']);
  });

  it('reports document.duplicate-anchor once per anchor shared by 3+ nodes', () => {
    const aId = idGen();
    const bId = idGen();
    const cId = idGen();
    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      nodes: {
        root: { id: 'root', type: 'buildr/page', slots: { default: [aId, bId, cId] } },
        [aId]: { id: aId, type: 'buildr/text', anchor: 'dup' },
        [bId]: { id: bId, type: 'buildr/text', anchor: 'dup' },
        [cId]: { id: cId, type: 'buildr/text', anchor: 'dup' },
      },
      components: { 'buildr/page': 1, 'buildr/text': 1 },
    };
    const diagnostics = checkInvariants(doc);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('document.duplicate-anchor');
    expect(diagnostics[0]?.details?.nodeIds).toEqual([aId, bId, cId]);
  });
});

describe('assertDocumentInvariants', () => {
  it('does not throw for a valid document', () => {
    expect(() => assertDocumentInvariants(smallValidDocument())).not.toThrow();
  });

  it('throws with the violated codes for a corrupted document', () => {
    const doc = smallValidDocument();
    const orphanId = idGen();
    const corrupted: BuilderDocument = {
      ...doc,
      nodes: { ...doc.nodes, [orphanId]: { id: orphanId, type: 'buildr/text' } },
    };
    expect(() => assertDocumentInvariants(corrupted)).toThrow(/document\.orphan-node/);
  });
});
