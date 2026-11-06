import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const headingFixtures: readonly ComponentFixture[] = [
  {
    id: 'heading-levels',
    title: 'Heading: every level, in order',
    tree: {
      type: 'buildr/container',
      props: { width: s('none') },
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
  {
    id: 'heading-tags',
    title: 'Heading: styled as a heading but rendered as another tag',
    tree: {
      type: 'buildr/container',
      props: { width: s('none') },
      children: ['p', 'span', 'div', 'strong'].map((tag) => ({
        type: 'buildr/heading',
        props: { text: s(`As ${tag}`), level: s(3), tag: s(tag) },
      })),
    },
  },
] as const;
