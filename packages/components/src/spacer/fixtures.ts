import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const spacerFixtures: readonly ComponentFixture[] = [
  { id: 'spacer-default', title: 'Spacer: default', tree: { type: 'buildr/spacer' } },
  {
    id: 'spacer-alternate',
    title: 'Spacer: alternate',
    tree: { type: 'buildr/spacer', props: { size: s('xl'), axis: s('horizontal') } },
  },
];
