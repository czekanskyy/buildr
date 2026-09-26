import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

/** The page itself is the document root; its fixtures are pages with a little content. */
export const pageFixtures: readonly ComponentFixture[] = [
  {
    id: 'page-empty',
    title: 'Page: empty',
    tree: { type: 'buildr/section', props: { ariaLabel: s('Empty page') } },
  },
] as const;
