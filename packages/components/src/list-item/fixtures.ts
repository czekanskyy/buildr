import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const listItemFixtures: readonly ComponentFixture[] = [
  {
    id: 'list-item-bound',
    title: 'List item: bound to data',
    tree: {
      type: 'buildr/list',
      children: [
        { type: 'buildr/list-item', props: { text: s('Static') } },
        {
          type: 'buildr/list-item',
          props: { text: { kind: 'binding', path: 'post.title' } as never },
        },
      ],
    },
  },
] as const;
