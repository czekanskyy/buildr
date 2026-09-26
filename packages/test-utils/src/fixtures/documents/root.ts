import type { BuilderDocument } from '@next-buildr/core';
import { baseTree } from './base.ts';
import type { InvalidDocumentFixture } from './types.ts';

function rootNodeMissing(): InvalidDocumentFixture {
  const { doc } = baseTree('test-utils/fixtures/root/missing');
  const { root: _root, ...rest } = doc.nodes;
  const corrupted: BuilderDocument = { ...doc, nodes: rest };
  return {
    name: 'the document has no node at its root key',
    expectedCode: 'document.root-missing',
    doc: corrupted,
  };
}

function rootNodeWrongType(): InvalidDocumentFixture {
  const { doc } = baseTree('test-utils/fixtures/root/wrong-type');
  const { root } = doc.nodes;
  if (!root) throw new Error('base tree missing its root node');
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: { ...doc.nodes, root: { ...root, type: 'buildr/section' } },
  };
  return {
    name: "the root node's type isn't the fixed root component type",
    expectedCode: 'document.root-wrong-type',
    doc: corrupted,
  };
}

function rootReferencedAsAChildOfANestedNode(): InvalidDocumentFixture {
  const { doc, sectionId } = baseTree('test-utils/fixtures/root/referenced-nested');
  const section = doc.nodes[sectionId];
  if (!section) throw new Error('base tree missing its section node');
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [sectionId]: { ...section, slots: { ...section.slots, extra: ['root'] } },
    },
  };
  return {
    name: 'a nested slot lists the root as one of its children',
    expectedCode: 'document.root-referenced-as-child',
    doc: corrupted,
  };
}

function rootReferencedAsItsOwnChild(): InvalidDocumentFixture {
  const { doc } = baseTree('test-utils/fixtures/root/referenced-self');
  const { root } = doc.nodes;
  if (!root) throw new Error('base tree missing its root node');
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: { ...doc.nodes, root: { ...root, slots: { ...root.slots, extra: ['root'] } } },
  };
  return {
    name: 'the root lists itself as one of its own children',
    expectedCode: 'document.root-referenced-as-child',
    doc: corrupted,
  };
}

export const rootFixtures: readonly InvalidDocumentFixture[] = [
  rootNodeMissing(),
  rootNodeWrongType(),
  rootReferencedAsAChildOfANestedNode(),
  rootReferencedAsItsOwnChild(),
];
