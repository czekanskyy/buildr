import { type BuilderDocument, createSeededIdGenerator } from '@buildr/core';
import { node } from '../../builders.ts';
import { baseTree } from './base.ts';
import type { InvalidDocumentFixture } from './types.ts';

function twoSiblingsShareAnAnchor(): InvalidDocumentFixture {
  const { doc, headingId, textId } = baseTree('test-utils/fixtures/duplicate-anchors/siblings');
  const heading = doc.nodes[headingId];
  const textAnchor = doc.nodes[textId]?.anchor;
  if (!heading || !textAnchor) throw new Error('base tree missing expected nodes');
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: { ...doc.nodes, [headingId]: { ...heading, anchor: textAnchor } },
  };
  return {
    name: 'two sibling nodes sharing an anchor',
    expectedCode: 'document.duplicate-anchor',
    doc: corrupted,
  };
}

function twoNodesAtDifferentDepthsShareAnAnchor(): InvalidDocumentFixture {
  const { idGen, doc, sectionId } = baseTree('test-utils/fixtures/duplicate-anchors/depths');
  const { root } = doc.nodes;
  const sectionAnchor = doc.nodes[sectionId]?.anchor;
  if (!root || !sectionAnchor) throw new Error('base tree missing expected nodes');
  const deepId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      root: { ...root, slots: { ...root.slots, extra: [deepId] } },
      [deepId]: node({ id: deepId, type: 'buildr/text', anchor: sectionAnchor }, idGen),
    },
  };
  return {
    name: 'two nodes at different depths sharing an anchor',
    expectedCode: 'document.duplicate-anchor',
    doc: corrupted,
  };
}

function threeNodesShareOneAnchor(): InvalidDocumentFixture {
  const idGen = createSeededIdGenerator('test-utils/fixtures/duplicate-anchors/three-way');
  const aId = idGen();
  const bId = idGen();
  const cId = idGen();
  const doc: BuilderDocument = {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: node({ id: 'root', type: 'buildr/page', slots: { default: [aId, bId, cId] } }, idGen),
      [aId]: node({ id: aId, type: 'buildr/text', anchor: 'dup' }, idGen),
      [bId]: node({ id: bId, type: 'buildr/text', anchor: 'dup' }, idGen),
      [cId]: node({ id: cId, type: 'buildr/text', anchor: 'dup' }, idGen),
    },
    components: { 'buildr/page': 1, 'buildr/text': 1 },
  };
  return {
    name: 'three nodes sharing one anchor',
    expectedCode: 'document.duplicate-anchor',
    doc,
  };
}

function twoSeparateAnchorCollisions(): InvalidDocumentFixture {
  const { idGen, doc, headingId, textId, sectionId } = baseTree(
    'test-utils/fixtures/duplicate-anchors/two-collisions',
  );
  const { root } = doc.nodes;
  const heading = doc.nodes[headingId];
  const textAnchor = doc.nodes[textId]?.anchor;
  const sectionAnchor = doc.nodes[sectionId]?.anchor;
  if (!root || !heading || !textAnchor || !sectionAnchor) {
    throw new Error('base tree missing expected nodes');
  }
  const extraId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      root: { ...root, slots: { ...root.slots, extra: [extraId] } },
      // Collision 1: heading now shares `text`'s anchor.
      [headingId]: { ...heading, anchor: textAnchor },
      // Collision 2: a new node shares `section`'s original anchor.
      [extraId]: node({ id: extraId, type: 'buildr/text', anchor: sectionAnchor }, idGen),
    },
  };
  return {
    name: 'two independent anchor collisions in the same document',
    expectedCode: 'document.duplicate-anchor',
    doc: corrupted,
  };
}

export const duplicateAnchorFixtures: readonly InvalidDocumentFixture[] = [
  twoSiblingsShareAnAnchor(),
  twoNodesAtDifferentDepthsShareAnAnchor(),
  threeNodesShareOneAnchor(),
  twoSeparateAnchorCollisions(),
];
