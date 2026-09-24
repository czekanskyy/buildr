import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const selectFixtures: readonly ComponentFixture[] = [
  {
    id: 'select-topic',
    title: 'Select: a required choice with a placeholder',
    tree: {
      type: 'buildr/form',
      children: [
        {
          type: 'buildr/select',
          props: {
            label: s('Topic'),
            name: s('topic'),
            required: s(true),
            placeholder: s('Choose a topic'),
            options: s([
              { label: 'Sales', value: 'sales' },
              { label: 'Support', value: 'support' },
              { label: 'Other', value: 'other' },
            ]) as never,
          },
        },
      ] as never,
    },
  },
] as const;
