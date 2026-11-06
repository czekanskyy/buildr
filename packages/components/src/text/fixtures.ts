import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const t = (text: string, format = 0) => ({ type: 'text', version: 1, text, format });

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
  {
    id: 'text-rich',
    title: 'Text: rich text mode',
    tree: {
      type: 'buildr/text',
      props: {
        mode: s('rich'),
        rich: s({
          type: 'root',
          version: 1,
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [t('Some '), t('bold', 1), t(' and '), t('italic', 2), t(' text.')],
            },
          ],
        }),
      },
    },
  },
] as const;
