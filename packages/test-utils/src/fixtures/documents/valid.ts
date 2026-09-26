import { type BuilderDocument, createEmptyDocument, s } from '@next-buildr/core';
import { doc } from '../../builders.ts';
import { baseTree } from './base.ts';

/** A handful of structurally valid documents — `checkInvariants` must report zero diagnostics for each. */
export const validDocumentFixtures: readonly BuilderDocument[] = [
  createEmptyDocument(),
  baseTree('test-utils/fixtures/valid/base-tree').doc,
  doc({
    type: 'buildr/page',
    children: [
      {
        type: 'buildr/section',
        anchor: 'hero',
        children: [
          { type: 'buildr/heading', props: { level: s(1) } },
          { type: 'buildr/text', anchor: 'intro' },
        ],
      },
      {
        type: 'buildr/section',
        anchor: 'footer',
        slots: {
          default: [{ type: 'buildr/text' }],
          aside: [{ type: 'buildr/text', anchor: 'footer-aside' }],
        },
      },
    ],
  }),
];
