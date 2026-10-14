import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const probes = [{ type: 'test/probe' }, { type: 'test/probe' }, { type: 'test/probe' }] as const;

const padded = (desktop: string, tablet: string, mobile: string) =>
  ({
    base: { spacing: { padding: { top: desktop, bottom: desktop } } },
    bp: {
      tablet: { spacing: { padding: { top: tablet, bottom: tablet } } },
      mobile: { spacing: { padding: { top: mobile, bottom: mobile } } },
    },
  }) as never;

/** Uses the sample media of the image fixtures (`m1`). */
const backgroundImage = s({ source: 'fixtures', collection: 'media', id: 'm1' }) as never;

export const containerFixtures: readonly ComponentFixture[] = [
  {
    id: 'container-default',
    title: 'Container: default (flex column)',
    tree: { type: 'buildr/container', children: probes },
  },
  {
    id: 'container-block',
    title: 'Container: box',
    tree: { type: 'buildr/container', props: { display: s('block') }, children: probes },
  },
  {
    id: 'container-grid',
    title: 'Container: grid',
    tree: {
      type: 'buildr/container',
      props: { display: s('grid') },
      children: probes,
      styles: {
        base: { layout: { columns: 3 } },
        bp: { mobile: { layout: { columns: 1 } } },
      } as never,
    },
  },
  {
    id: 'container-inline-flex',
    title: 'Container: inline flex',
    tree: {
      type: 'buildr/container',
      props: { display: s('inline-flex'), width: s('none') },
      children: probes,
    },
  },
  {
    id: 'container-inline-block',
    title: 'Container: inline box',
    tree: {
      type: 'buildr/container',
      props: { display: s('inline-block'), width: s('none') },
      children: probes,
    },
  },
  {
    id: 'container-narrow',
    title: 'Container: narrow',
    tree: {
      type: 'buildr/container',
      props: { width: s('sm') },
      children: [{ type: 'test/probe' }],
      styles: padded('2rem', '1.5rem', '1rem'),
    },
  },
  {
    id: 'container-no-limit',
    title: 'Container: no width limit',
    tree: { type: 'buildr/container', props: { width: s('none') }, children: probes },
  },
  {
    id: 'container-row-to-column',
    title: 'Container: a row that becomes a column on mobile',
    tree: {
      type: 'buildr/container',
      props: { width: s('none') },
      children: probes,
      styles: {
        base: { layout: { direction: 'row', gap: '1rem', align: 'center' } },
        bp: { mobile: { layout: { direction: 'column', align: 'stretch' } } },
      } as never,
    },
  },
  {
    id: 'container-group',
    title: 'Container: a named group',
    tree: {
      type: 'buildr/container',
      props: { role: s('group'), ariaLabel: s('Contact options'), width: s('none') },
      children: probes,
    },
  },
  {
    id: 'container-landmark',
    title: 'Container: a landmark',
    tree: {
      type: 'buildr/container',
      props: { as: s('header'), width: s('xl'), ariaLabel: s('Site header') },
      children: [{ type: 'test/probe' }],
    },
  },
  {
    id: 'container-bleed',
    title: 'Container: full-width background, content in a column',
    tree: {
      type: 'buildr/container',
      props: { as: s('section'), bleed: s(true), width: s('md'), ariaLabel: s('Band') },
      children: [{ type: 'test/probe' }],
      styles: {
        base: { background: { color: '$color.surface' } },
      } as never,
    },
  },
  {
    id: 'container-background-image',
    title: 'Container: background image',
    tree: {
      type: 'buildr/container',
      props: {
        as: s('section'),
        bleed: s(true),
        backgroundImage,
        ariaLabel: s('Hero'),
      },
      children: [{ type: 'test/probe' }],
      styles: padded('4rem', '3rem', '1.5rem'),
    },
  },
] as const;
