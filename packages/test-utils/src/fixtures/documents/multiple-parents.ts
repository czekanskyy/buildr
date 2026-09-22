import type { BuilderDocument } from '@buildr/core';
import { node } from '../../builders.ts';
import { baseTree } from './base.ts';
import type { InvalidDocumentFixture } from './types.ts';

function referencedFromTwoSlotsOnTheSameParent(): InvalidDocumentFixture {
  const { doc, sectionId, headingId } = baseTree('test-utils/fixtures/multiple-parents/two-slots');
  const section = doc.nodes[sectionId];
  if (!section) throw new Error('base tree missing its section node');
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [sectionId]: { ...section, slots: { ...section.slots, extra: [headingId] } },
    },
  };
  return {
    name: 'a node referenced from two slots on the same parent',
    expectedCode: 'document.multiple-parents',
    doc: corrupted,
  };
}

function referencedTwiceInTheSameSlotArray(): InvalidDocumentFixture {
  const { doc, sectionId, headingId } = baseTree('test-utils/fixtures/multiple-parents/same-slot');
  const section = doc.nodes[sectionId];
  if (!section) throw new Error('base tree missing its section node');
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [sectionId]: { ...section, slots: { ...section.slots, extra: [headingId, headingId] } },
    },
  };
  return {
    name: 'a node listed twice within a single slot array',
    expectedCode: 'document.multiple-parents',
    doc: corrupted,
  };
}

function referencedByTwoUnrelatedParents(): InvalidDocumentFixture {
  const { idGen, doc, headingId } = baseTree('test-utils/fixtures/multiple-parents/unrelated');
  const { root } = doc.nodes;
  if (!root) throw new Error('base tree missing its root node');
  const asideId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      root: { ...root, slots: { ...root.slots, aside: [asideId] } },
      [asideId]: node(
        { id: asideId, type: 'buildr/section', slots: { default: [headingId] } },
        idGen,
      ),
    },
  };
  return {
    name: 'a node referenced by two unrelated parents',
    expectedCode: 'document.multiple-parents',
    doc: corrupted,
  };
}

function referencedByBothParentAndGrandparent(): InvalidDocumentFixture {
  const { doc, headingId } = baseTree('test-utils/fixtures/multiple-parents/skip-level');
  const { root } = doc.nodes;
  if (!root) throw new Error('base tree missing its root node');
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      root: { ...root, slots: { ...root.slots, extra: [headingId] } },
    },
  };
  return {
    name: 'a node referenced by both its parent and its grandparent',
    expectedCode: 'document.multiple-parents',
    doc: corrupted,
  };
}

export const multipleParentsFixtures: readonly InvalidDocumentFixture[] = [
  referencedFromTwoSlotsOnTheSameParent(),
  referencedTwiceInTheSameSlotArray(),
  referencedByTwoUnrelatedParents(),
  referencedByBothParentAndGrandparent(),
];
