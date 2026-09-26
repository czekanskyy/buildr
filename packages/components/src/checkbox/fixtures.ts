import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const checkboxFixtures: readonly ComponentFixture[] = [
  {
    id: 'checkbox-consent',
    title: 'Checkbox: a required consent with a hint',
    tree: {
      type: 'buildr/form',
      children: [
        {
          type: 'buildr/checkbox',
          props: {
            label: s('I agree to the terms'),
            name: s('agree'),
            required: s(true),
            hint: s('You can withdraw at any time.'),
          },
        },
      ] as never,
    },
  },
] as const;
