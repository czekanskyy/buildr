import type { BuilderDocument } from '@buildr/core';
import { baseTree } from './base.ts';
import type { InvalidDocumentFixture } from './types.ts';

function missingChildOnTheRoot(): InvalidDocumentFixture {
  const { idGen, doc } = baseTree('test-utils/fixtures/dangling-children/root');
  const { root } = doc.nodes;
  if (!root) throw new Error('base tree missing its root node');
  const missingId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: { ...doc.nodes, root: { ...root, slots: { ...root.slots, extra: [missingId] } } },
  };
  return {
    name: "a slot on the root that references a node that doesn't exist",
    expectedCode: 'document.dangling-child',
    doc: corrupted,
  };
}

function missingChildOnANestedNode(): InvalidDocumentFixture {
  const { idGen, doc, sectionId } = baseTree('test-utils/fixtures/dangling-children/nested');
  const section = doc.nodes[sectionId];
  if (!section) throw new Error('base tree missing its section node');
  const missingId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [sectionId]: { ...section, slots: { ...section.slots, extra: [missingId] } },
    },
  };
  return {
    name: "a slot on a nested node that references a node that doesn't exist",
    expectedCode: 'document.dangling-child',
    doc: corrupted,
  };
}

export const danglingChildFixtures: readonly InvalidDocumentFixture[] = [
  missingChildOnTheRoot(),
  missingChildOnANestedNode(),
];
