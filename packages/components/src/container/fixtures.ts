import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const containerFixtures: readonly ComponentFixture[] = [
  { id: 'container-default', title: 'Container: default', tree: { type: 'buildr/container' } },
  {
    id: 'container-narrow',
    title: 'Container: narrow',
    tree: {
      type: 'buildr/container',
      props: { width: s('sm') },
      styles: {
        base: { spacing: { padding: { top: '2rem', bottom: '2rem' } } },
        bp: { mobile: { spacing: { padding: { top: '1rem', bottom: '1rem' } } } },
      } as never,
    },
  },
] as const;
