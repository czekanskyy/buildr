import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const linkFixtures: readonly ComponentFixture[] = [
  {
    id: 'link-internal',
    title: 'Link: to a page of the site',
    tree: { type: 'buildr/link', props: { label: s('About us'), href: s('/about') } },
  },
  {
    id: 'link-new-tab',
    title: 'Link: opening in a new tab',
    tree: {
      type: 'buildr/link',
      props: { label: s('Example'), href: s('https://example.com'), newTab: s(true) },
    },
  },
  {
    id: 'link-bound',
    title: 'Link: bound to data',
    tree: {
      type: 'buildr/link',
      props: {
        label: { kind: 'binding', path: 'post.title' } as never,
        href: { kind: 'binding', path: 'post.url' } as never,
      },
    },
  },
] as const;
