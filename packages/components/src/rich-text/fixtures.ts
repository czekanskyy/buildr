import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const t = (text: string, format = 0) => ({ type: 'text', version: 1, text, format });
const block = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
  type,
  version: 1,
  children,
  ...extra,
});

/** An article-shaped value: every node type of the supported subset. */
export const ARTICLE = {
  type: 'root',
  version: 1,
  children: [
    block('heading', [t('A heading')], { tag: 'h2' }),
    block('paragraph', [
      t('Text with '),
      t('bold', 1),
      t(', '),
      t('italic', 2),
      t(' and '),
      t('code', 16),
      t(', and a '),
      block('link', [t('link')], { url: 'https://example.com' }),
      t('.'),
    ]),
    block('list', [block('listitem', [t('One')]), block('listitem', [t('Two')])], {
      listType: 'bullet',
    }),
    block('list', [block('listitem', [t('First')]), block('listitem', [t('Second')])], {
      listType: 'number',
    }),
    block('quote', [t('A quotation.')]),
  ],
};

export const richTextFixtures: readonly ComponentFixture[] = [
  {
    id: 'rich-text-article',
    title: 'Rich text: an article',
    tree: { type: 'buildr/rich-text', props: { content: s(ARTICLE) as never } },
  },
  {
    id: 'rich-text-bound',
    title: 'Rich text: bound to a post body',
    tree: {
      type: 'buildr/rich-text',
      props: { content: { kind: 'binding', path: 'post.body' } as never },
    },
  },
  {
    id: 'rich-text-narrow',
    title: 'Rich text: a narrow column, larger text on desktop',
    tree: {
      type: 'buildr/rich-text',
      props: { content: s(ARTICLE) as never },
      styles: {
        base: { typography: { fontSize: '1.125rem' }, size: { maxWidth: '40rem' } },
        bp: { mobile: { typography: { fontSize: '1rem' } } },
      } as never,
    },
  },
] as const;
