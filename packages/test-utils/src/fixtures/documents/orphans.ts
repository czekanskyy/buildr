import type { BuilderDocument } from '@buildr/core';
import { node } from '../../builders.ts';
import { baseTree } from './base.ts';
import type { InvalidDocumentFixture } from './types.ts';

function unreferencedLeaf(): InvalidDocumentFixture {
  const { idGen, doc } = baseTree('test-utils/fixtures/orphans/leaf');
  const orphanId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: { ...doc.nodes, [orphanId]: node({ id: orphanId, type: 'buildr/text' }, idGen) },
  };
  return {
    name: 'an unreferenced leaf node',
    expectedCode: 'document.orphan-node',
    doc: corrupted,
  };
}

function unreferencedSubtree(): InvalidDocumentFixture {
  const { idGen, doc } = baseTree('test-utils/fixtures/orphans/subtree');
  const parentId = idGen();
  const childId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [parentId]: node(
        { id: parentId, type: 'buildr/section', slots: { default: [childId] } },
        idGen,
      ),
      [childId]: node({ id: childId, type: 'buildr/text' }, idGen),
    },
  };
  return {
    name: 'an unreferenced parent/child subtree',
    expectedCode: 'document.orphan-node',
    doc: corrupted,
  };
}

function unreferencedSiblingOfARealNode(): InvalidDocumentFixture {
  const { idGen, doc } = baseTree('test-utils/fixtures/orphans/sibling');
  const orphanId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [orphanId]: node({ id: orphanId, type: 'buildr/section', name: 'Dead section' }, idGen),
    },
  };
  return {
    name: 'an unreferenced node alongside an otherwise-valid tree',
    expectedCode: 'document.orphan-node',
    doc: corrupted,
  };
}

function twoIndependentUnreferencedLeaves(): InvalidDocumentFixture {
  const { idGen, doc } = baseTree('test-utils/fixtures/orphans/two-leaves');
  const firstId = idGen();
  const secondId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [firstId]: node({ id: firstId, type: 'buildr/text' }, idGen),
      [secondId]: node({ id: secondId, type: 'buildr/text' }, idGen),
    },
  };
  return {
    name: 'two independent unreferenced leaves',
    expectedCode: 'document.orphan-node',
    doc: corrupted,
  };
}

export const orphanFixtures: readonly InvalidDocumentFixture[] = [
  unreferencedLeaf(),
  unreferencedSubtree(),
  unreferencedSiblingOfARealNode(),
  twoIndependentUnreferencedLeaves(),
];
