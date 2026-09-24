import type { ComponentFixture } from '../fixtures.ts';

const cells = (n: number) => Array.from({ length: n }, () => ({ type: 'test/probe' }));

export const gridFixtures: readonly ComponentFixture[] = [
  {
    id: 'grid-auto',
    title: 'Grid: automatic columns',
    tree: { type: 'buildr/grid', children: cells(6) },
  },
  {
    id: 'grid-responsive',
    title: 'Grid: 3 columns, 2 on tablet, 1 on mobile',
    tree: {
      type: 'buildr/grid',
      children: cells(6),
      styles: {
        base: { layout: { columns: 3, gap: '1.5rem' } },
        bp: {
          tablet: { layout: { columns: 2 } },
          mobile: { layout: { columns: 1 } },
        },
      } as never,
    },
  },
  {
    id: 'grid-spans',
    title: 'Grid: a wide cell',
    tree: {
      type: 'buildr/grid',
      styles: { base: { layout: { columns: 3 } } } as never,
      children: [
        { type: 'test/probe', styles: { base: { layout: { columnSpan: 2 } } } as never },
        { type: 'test/probe' },
        { type: 'test/probe' },
      ],
    },
  },
] as const;
