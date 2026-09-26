import { type BuilderDocument, createSeededIdGenerator } from '@next-buildr/core';
import { node } from '../../builders.ts';
import { baseTree } from './base.ts';
import type { InvalidDocumentFixture } from './types.ts';

function mapKeyDoesNotMatchNodeId(): InvalidDocumentFixture {
  const idGen = createSeededIdGenerator('test-utils/fixtures/mismatched-keys/single');
  const mapKey = idGen();
  const wrongId = idGen();
  const doc: BuilderDocument = {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: node({ id: 'root', type: 'buildr/page', slots: { default: [mapKey] } }, idGen),
      // Correctly reachable under `mapKey` — only the node's own `id` field lies.
      [mapKey]: node({ id: wrongId, type: 'buildr/text' }, idGen),
    },
    components: { 'buildr/page': 1, 'buildr/text': 1 },
  };
  return {
    name: "a node whose own id field doesn't match the map key it's stored under",
    expectedCode: 'document.node-id-mismatch',
    doc,
  };
}

function twoNodesWithSwappedIdentities(): InvalidDocumentFixture {
  const idGen = createSeededIdGenerator('test-utils/fixtures/mismatched-keys/swapped');
  const keyA = idGen();
  const keyB = idGen();
  const doc: BuilderDocument = {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: node({ id: 'root', type: 'buildr/page', slots: { default: [keyA, keyB] } }, idGen),
      [keyA]: node({ id: keyB, type: 'buildr/text' }, idGen),
      [keyB]: node({ id: keyA, type: 'buildr/text' }, idGen),
    },
    components: { 'buildr/page': 1, 'buildr/text': 1 },
  };
  return {
    name: "two nodes stored under each other's id",
    expectedCode: 'document.node-id-mismatch',
    doc,
  };
}

function mismatchedKeyNestedInsideAValidSubtree(): InvalidDocumentFixture {
  const { idGen, doc, sectionId } = baseTree('test-utils/fixtures/mismatched-keys/nested');
  const section = doc.nodes[sectionId];
  if (!section) throw new Error('base tree missing its section node');
  const mapKey = idGen();
  const wrongId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [sectionId]: { ...section, slots: { ...section.slots, extra: [mapKey] } },
      [mapKey]: node({ id: wrongId, type: 'buildr/text' }, idGen),
    },
  };
  return {
    name: 'a mismatched key nested a few levels deep in an otherwise-valid tree',
    expectedCode: 'document.node-id-mismatch',
    doc: corrupted,
  };
}

function mismatchedKeyOnANodeWithItsOwnChildren(): InvalidDocumentFixture {
  const idGen = createSeededIdGenerator('test-utils/fixtures/mismatched-keys/with-children');
  const mapKey = idGen();
  const wrongId = idGen();
  const childId = idGen();
  const doc: BuilderDocument = {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: node({ id: 'root', type: 'buildr/page', slots: { default: [mapKey] } }, idGen),
      [mapKey]: node({ id: wrongId, type: 'buildr/section', slots: { default: [childId] } }, idGen),
      [childId]: node({ id: childId, type: 'buildr/text' }, idGen),
    },
    components: { 'buildr/page': 1, 'buildr/section': 1, 'buildr/text': 1 },
  };
  return {
    name: 'a mismatched-key node that itself has children',
    expectedCode: 'document.node-id-mismatch',
    doc,
  };
}

export const mismatchedKeyFixtures: readonly InvalidDocumentFixture[] = [
  mapKeyDoesNotMatchNodeId(),
  twoNodesWithSwappedIdentities(),
  mismatchedKeyNestedInsideAValidSubtree(),
  mismatchedKeyOnANodeWithItsOwnChildren(),
];
