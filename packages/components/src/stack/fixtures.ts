import { s } from '@buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const probes = [{ type: 'test/probe' }, { type: 'test/probe' }, { type: 'test/probe' }] as const;

export const stackFixtures: readonly ComponentFixture[] = [
  { id: 'stack-column', title: 'Stack: column', tree: { type: 'buildr/stack', children: probes } },
  {
    id: 'stack-row-to-column',
    title: 'Stack: a row that becomes a column on mobile',
    tree: {
      type: 'buildr/stack',
      children: probes,
      styles: {
        base: { layout: { direction: 'row', gap: '1rem', align: 'center' } },
        bp: { mobile: { layout: { direction: 'column', align: 'stretch' } } },
      } as never,
    },
  },
  {
    id: 'stack-group',
    title: 'Stack: a named group',
    tree: {
      type: 'buildr/stack',
      props: { role: s('group'), ariaLabel: s('Contact options') },
      children: probes,
    },
  },
] as const;
