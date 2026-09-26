import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const formFixtures: readonly ComponentFixture[] = [
  {
    id: 'form-contact',
    title: 'Form: a contact form',
    tree: {
      type: 'buildr/form',
      props: { successMessage: s('Thanks, we will be in touch.') },
      children: [
        {
          type: 'buildr/input',
          props: { label: s('Name'), name: s('name'), required: s(true) },
        },
        {
          type: 'buildr/input',
          props: { label: s('Email'), name: s('email'), type: s('email'), required: s(true) },
        },
        {
          type: 'buildr/select',
          props: {
            label: s('Topic'),
            name: s('topic'),
            options: s([
              { label: 'Sales', value: 'sales' },
              { label: 'Support', value: 'support' },
            ]) as never,
          },
        },
        {
          type: 'buildr/textarea',
          props: { label: s('Message'), name: s('message'), required: s(true), maxLength: s(2000) },
        },
        {
          type: 'buildr/checkbox',
          props: { label: s('Send me a copy'), name: s('copy') },
        },
        { type: 'buildr/button', props: { label: s('Send'), type: s('submit') } },
      ] as never,
      styles: {
        base: { spacing: { padding: { top: '1rem', bottom: '1rem' } } },
        bp: { mobile: { spacing: { padding: { top: '0.5rem', bottom: '0.5rem' } } } },
      } as never,
    },
  },
] as const;
