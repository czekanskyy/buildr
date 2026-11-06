import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const anchorFixtures: readonly ComponentFixture[] = [
  {
    id: 'anchor-default',
    title: 'Anchor: default',
    tree: { type: 'buildr/anchor', props: { name: s('details') } },
  },
  {
    id: 'anchor-alternate',
    title: 'Anchor: alternate',
    tree: { type: 'buildr/anchor', props: { name: s('contact') } },
  },
];
