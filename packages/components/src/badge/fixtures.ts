import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const badgeFixtures: readonly ComponentFixture[] = [
  {
    id: 'badge-variants',
    title: 'Badge: every variant',
    tree: {
      type: 'buildr/stack',
      styles: { base: { layout: { direction: 'row', gap: '0.5rem', wrap: 'wrap' } } } as never,
      children: ['neutral', 'primary', 'success', 'warning', 'danger'].map((variant) => ({
        type: 'buildr/badge',
        props: { text: s(variant), variant: s(variant) },
      })),
    },
  },
] as const;
