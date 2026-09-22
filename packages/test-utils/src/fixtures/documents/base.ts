import { type BuilderDocument, createSeededIdGenerator, type IdGenerator } from '@buildr/core';
import { node } from '../../builders.ts';

/** A small, valid document (`root -> section -> [heading, text]`) plus its node IDs, for fixtures to corrupt. */
export interface BaseTree {
  readonly idGen: IdGenerator;
  readonly doc: BuilderDocument;
  readonly sectionId: string;
  readonly headingId: string;
  readonly textId: string;
}

export function baseTree(seed: string): BaseTree {
  const idGen = createSeededIdGenerator(seed);
  const sectionId = idGen();
  const headingId = idGen();
  const textId = idGen();

  const root = node({ id: 'root', type: 'buildr/page', slots: { default: [sectionId] } }, idGen);
  const section = node(
    {
      id: sectionId,
      type: 'buildr/section',
      anchor: 'hero',
      slots: { default: [headingId, textId] },
    },
    idGen,
  );
  const heading = node({ id: headingId, type: 'buildr/heading' }, idGen);
  const text = node({ id: textId, type: 'buildr/text', anchor: 'intro' }, idGen);

  return {
    idGen,
    doc: {
      schemaVersion: 1,
      root: 'root',
      nodes: { root, [sectionId]: section, [headingId]: heading, [textId]: text },
      components: { 'buildr/page': 1, 'buildr/section': 1, 'buildr/heading': 1, 'buildr/text': 1 },
    },
    sectionId,
    headingId,
    textId,
  };
}
