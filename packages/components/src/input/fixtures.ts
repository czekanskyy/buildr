import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const inForm = (...fields: object[]) => ({ type: 'buildr/form', children: fields as never });

export const inputFixtures: readonly ComponentFixture[] = [
  {
    id: 'input-text',
    title: 'Input: a required text field with a hint',
    tree: inForm({
      type: 'buildr/input',
      props: {
        label: s('Your name'),
        name: s('name'),
        required: s(true),
        hint: s('As on your ID'),
        maxLength: s(80),
      },
    }),
  },
  {
    id: 'input-email',
    title: 'Input: email, with a placeholder',
    tree: inForm({
      type: 'buildr/input',
      props: {
        label: s('Email'),
        name: s('email'),
        type: s('email'),
        placeholder: s('you@example.com'),
      },
    }),
  },
  {
    id: 'input-hidden-label',
    title: 'Input: a search field with its label hidden',
    tree: inForm({
      type: 'buildr/input',
      props: { label: s('Search'), name: s('q'), hideLabel: s(true) },
    }),
  },
] as const;
