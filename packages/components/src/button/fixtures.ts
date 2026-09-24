import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const variants = ['primary', 'secondary', 'outline', 'ghost'] as const;

export const buttonFixtures: readonly ComponentFixture[] = [
  {
    id: 'button-variants',
    title: 'Button: every variant',
    tree: {
      type: 'buildr/stack',
      styles: {
        base: { layout: { direction: 'row', gap: '1rem', wrap: 'wrap' } },
        bp: { mobile: { layout: { direction: 'column' } } },
      } as never,
      children: variants.map((variant) => ({
        type: 'buildr/button',
        props: { label: s(variant), variant: s(variant) },
      })),
    },
  },
  {
    id: 'button-link',
    title: 'Button: a link, opening in a new tab',
    tree: {
      type: 'buildr/button',
      props: { label: s('Read the docs'), href: s('https://example.com/docs'), newTab: s(true) },
    },
  },
  {
    id: 'button-icon',
    title: 'Button: with an icon, and icon-only',
    tree: {
      type: 'buildr/stack',
      styles: { base: { layout: { direction: 'row', gap: '1rem' } } } as never,
      children: [
        {
          type: 'buildr/button',
          props: { label: s('Send'), icon: s('send'), iconPosition: s('end') },
        },
        {
          type: 'buildr/button',
          props: { label: s(''), icon: s('search'), ariaLabel: s('Search'), variant: s('outline') },
        },
      ],
    },
  },
  {
    id: 'button-submit',
    title: 'Button: submit, large',
    tree: {
      type: 'buildr/button',
      props: { label: s('Subscribe'), type: s('submit'), size: s('lg') },
    },
  },
] as const;
