import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';
export const fieldsetFixtures: readonly ComponentFixture[] = [
  {
    id: 'fieldset-default',
    title: 'Fieldset: default',
    tree: {
      type: 'buildr/form',
      children: [
        {
          type: 'buildr/fieldset',
          props: { legend: s('Contact details') },
          children: [{ type: 'buildr/input', props: { name: s('email'), label: s('Email') } }],
        },
      ],
    },
  },
  {
    id: 'fieldset-bound',
    title: 'Fieldset: bound legend',
    tree: {
      type: 'buildr/form',
      children: [
        {
          type: 'buildr/fieldset',
          props: { legend: { kind: 'binding', path: 'post.title' } as never, disabled: s(true) },
        },
      ],
    },
  },
];
