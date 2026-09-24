import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const textFixtures: readonly ComponentFixture[] = [
  {
    id: 'text-paragraph',
    title: 'Text: a paragraph',
    tree: { type: 'buildr/text', props: { text: s('A paragraph of text.\nWith a second line.') } },
  },
  {
    id: 'text-bound',
    title: 'Text: bound to data',
    tree: {
      type: 'buildr/text',
      props: { text: { kind: 'binding', path: 'post.excerpt' } as never },
    },
  },
  {
    id: 'text-small',
    title: 'Text: small, smaller on mobile',
    tree: {
      type: 'buildr/text',
      props: { text: s('Fine print'), as: s('small') },
      styles: {
        base: { typography: { fontSize: '0.875rem' } },
        bp: { mobile: { typography: { fontSize: '0.75rem' } } },
      } as never,
    },
  },
] as const;
