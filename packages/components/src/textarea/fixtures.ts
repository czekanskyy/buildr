import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const textareaFixtures: readonly ComponentFixture[] = [
  {
    id: 'textarea-message',
    title: 'Textarea: a message with a length limit',
    tree: {
      type: 'buildr/form',
      children: [
        {
          type: 'buildr/textarea',
          props: {
            label: s('Message'),
            name: s('message'),
            required: s(true),
            maxLength: s(1000),
            rows: s(6),
          },
        },
      ] as never,
    },
  },
] as const;
