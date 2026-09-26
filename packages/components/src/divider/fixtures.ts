import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const dividerFixtures: readonly ComponentFixture[] = [
  { id: 'divider-default', title: 'Divider: default', tree: { type: 'buildr/divider' } },
  {
    id: 'divider-decorative',
    title: 'Divider: decorative, thicker',
    tree: {
      type: 'buildr/divider',
      props: { decorative: s(true) },
      styles: { base: { border: { width: { top: '3px' } } } } as never,
    },
  },
] as const;
