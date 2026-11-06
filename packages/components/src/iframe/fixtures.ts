import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

// `.invalid` never resolves (RFC 6761): the gallery fetches nothing, and the frame stays empty.
export const iframeFixtures: readonly ComponentFixture[] = [
  {
    id: 'iframe-default',
    title: 'Iframe: 16:9, sandboxed',
    tree: {
      type: 'buildr/iframe',
      props: { url: s('https://embed.example.invalid/map'), title: s('Map of our office') },
    },
  },
  {
    id: 'iframe-square',
    title: 'Iframe: square',
    tree: {
      type: 'buildr/iframe',
      props: {
        url: s('https://embed.example.invalid/form'),
        title: s('Newsletter form'),
        aspectRatio: s('1:1'),
      },
    },
  },
  {
    id: 'iframe-empty',
    title: 'Iframe: no address yet',
    tree: { type: 'buildr/iframe', props: { title: s('Map of our office') } },
  },
] as const;
