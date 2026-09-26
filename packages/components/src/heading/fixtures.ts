import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const headingFixtures: readonly ComponentFixture[] = [
  {
    id: 'heading-levels',
    title: 'Heading: every level, in order',
    tree: {
      type: 'buildr/stack',
      children: [1, 2, 3, 4, 5, 6].map((level) => ({
        type: 'buildr/heading',
        props: { text: s(`Level ${level}`), level: s(level) },
      })),
    },
  },
  {
    id: 'heading-bound',
    title: 'Heading: bound to data',
    tree: {
      type: 'buildr/heading',
      props: { text: { kind: 'binding', path: 'post.title' } as never },
    },
  },
  {
    id: 'heading-look-vs-level',
    title: 'Heading: an h2 that looks small',
    tree: {
      type: 'buildr/heading',
      props: { text: s('Small h2'), level: s(2) },
      styles: {
        base: { typography: { fontSize: '1rem' } },
        bp: { mobile: { typography: { fontSize: '0.875rem' } } },
      } as never,
    },
  },
] as const;
