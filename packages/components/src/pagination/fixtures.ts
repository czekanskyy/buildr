import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

export const paginationFixtures: readonly ComponentFixture[] = [
  {
    id: 'pagination-middle',
    title: 'Pagination: page 5 of 12',
    tree: {
      type: 'buildr/pagination',
      props: { page: s(5), totalPages: s(12), hrefPattern: s('/blog?page={page}') },
    },
  },
  {
    id: 'pagination-few',
    title: 'Pagination: page 1 of 3',
    tree: { type: 'buildr/pagination', props: { page: s(1), totalPages: s(3) } },
  },
  {
    id: 'pagination-bound',
    title: 'Pagination: bound to the loop it follows',
    tree: {
      type: 'buildr/pagination',
      props: {
        page: { kind: 'binding', path: 'loop.page' } as never,
        totalPages: { kind: 'binding', path: 'loop.totalPages' } as never,
      },
    },
  },
] as const;
