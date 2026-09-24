import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const iconFixtures: readonly ComponentFixture[] = [
  {
    id: 'icon-sizes',
    title: 'Icon: every size',
    tree: {
      type: 'buildr/stack',
      styles: { base: { layout: { direction: 'row', gap: '1rem', align: 'center' } } } as never,
      children: ['sm', 'md', 'lg', 'xl'].map((size) => ({
        type: 'buildr/icon',
        props: { name: s('heart'), size: s(size) },
      })),
    },
  },
  {
    id: 'icon-labelled',
    title: 'Icon: with an accessible name',
    tree: { type: 'buildr/icon', props: { name: s('circle-alert'), label: s('Warning') } },
  },
] as const;
