import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const items = (...texts: string[]) =>
  texts.map((text) => ({ type: 'buildr/list-item', props: { text: s(text) } }));

export const listFixtures: readonly ComponentFixture[] = [
  {
    id: 'list-bullets',
    title: 'List: bullets',
    tree: { type: 'buildr/list', children: items('First', 'Second', 'Third') },
  },
  {
    id: 'list-numbered',
    title: 'List: numbered, with a nested list',
    tree: {
      type: 'buildr/list',
      props: { ordered: s(true) },
      children: [
        ...items('First'),
        {
          type: 'buildr/list-item',
          props: { text: s('Second') },
          children: [{ type: 'buildr/list', children: items('Nested a', 'Nested b') }],
        },
      ],
    },
  },
] as const;
