import type { BuilderDocument } from '@next-buildr/core';
import { node } from '../../builders.ts';
import { baseTree } from './base.ts';
import type { InvalidDocumentFixture } from './types.ts';

function selfCycle(): InvalidDocumentFixture {
  const { idGen, doc } = baseTree('test-utils/fixtures/cycles/self');
  const selfId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [selfId]: node({ id: selfId, type: 'buildr/section', slots: { default: [selfId] } }, idGen),
    },
  };
  return {
    name: 'a node that lists itself as its own child',
    expectedCode: 'document.cycle',
    doc: corrupted,
  };
}

function twoNodeRing(): InvalidDocumentFixture {
  const { idGen, doc } = baseTree('test-utils/fixtures/cycles/two-ring');
  const aId = idGen();
  const bId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [aId]: node({ id: aId, type: 'buildr/section', slots: { default: [bId] } }, idGen),
      [bId]: node({ id: bId, type: 'buildr/section', slots: { default: [aId] } }, idGen),
    },
  };
  return {
    name: 'a two-node ring unreachable from the root',
    expectedCode: 'document.cycle',
    doc: corrupted,
  };
}

function threeNodeRing(): InvalidDocumentFixture {
  const { idGen, doc } = baseTree('test-utils/fixtures/cycles/three-ring');
  const aId = idGen();
  const bId = idGen();
  const cId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [aId]: node({ id: aId, type: 'buildr/section', slots: { default: [bId] } }, idGen),
      [bId]: node({ id: bId, type: 'buildr/section', slots: { default: [cId] } }, idGen),
      [cId]: node({ id: cId, type: 'buildr/section', slots: { default: [aId] } }, idGen),
    },
  };
  return {
    name: 'a three-node ring unreachable from the root',
    expectedCode: 'document.cycle',
    doc: corrupted,
  };
}

function fourNodeRing(): InvalidDocumentFixture {
  const { idGen, doc } = baseTree('test-utils/fixtures/cycles/four-ring');
  const aId = idGen();
  const bId = idGen();
  const cId = idGen();
  const dId = idGen();
  const corrupted: BuilderDocument = {
    ...doc,
    nodes: {
      ...doc.nodes,
      [aId]: node({ id: aId, type: 'buildr/section', slots: { default: [bId] } }, idGen),
      [bId]: node({ id: bId, type: 'buildr/section', slots: { default: [cId] } }, idGen),
      [cId]: node({ id: cId, type: 'buildr/section', slots: { default: [dId] } }, idGen),
      [dId]: node({ id: dId, type: 'buildr/section', slots: { default: [aId] } }, idGen),
    },
  };
  return {
    name: 'a four-node ring unreachable from the root',
    expectedCode: 'document.cycle',
    doc: corrupted,
  };
}

export const cycleFixtures: readonly InvalidDocumentFixture[] = [
  selfCycle(),
  twoNodeRing(),
  threeNodeRing(),
  fourNodeRing(),
];
