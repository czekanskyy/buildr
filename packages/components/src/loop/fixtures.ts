import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const postsQuery = (limit: number) =>
  s({ type: 'query', spec: { source: 'posts', limit } }) as never;

export const loopFixtures: readonly ComponentFixture[] = [
  {
    id: 'loop-posts',
    title: 'Loop: posts as a grid, 3 columns then 1',
    tree: {
      type: 'buildr/loop',
      props: { source: postsQuery(10) },
      styles: {
        base: { layout: { display: 'grid', columns: 3, gap: '1rem' } },
        bp: { mobile: { layout: { columns: 1 } } },
      } as never,
      slots: {
        item: [
          {
            type: 'buildr/heading',
            props: { text: { kind: 'binding', path: 'item.title' } as never, level: s(3) },
          },
        ],
        empty: [{ type: 'buildr/text', props: { text: s('No posts yet.') } }],
      },
    },
  },
  {
    id: 'loop-empty',
    title: 'Loop: nothing to list',
    tree: {
      type: 'buildr/loop',
      props: { source: s({ type: 'query', spec: { source: 'nothing', limit: 10 } }) as never },
      slots: {
        item: [
          {
            type: 'buildr/text',
            props: { text: { kind: 'binding', path: 'item.title' } as never },
          },
        ],
        empty: [{ type: 'buildr/text', props: { text: s('Nothing here.') } }],
      },
    },
  },
] as const;

/** The collections the fixtures query (`MemoryDataSource` input). */
export const loopFixtureCollections = {
  posts: [{ title: 'First post' }, { title: 'Second post' }, { title: 'Third post' }],
} as const;
