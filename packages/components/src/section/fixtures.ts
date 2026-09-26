import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const padded = (desktop: string, tablet: string, mobile: string) =>
  ({
    base: { spacing: { padding: { top: desktop, bottom: desktop } } },
    bp: {
      tablet: { spacing: { padding: { top: tablet, bottom: tablet } } },
      mobile: { spacing: { padding: { top: mobile, bottom: mobile } } },
    },
  }) as never;

export const sectionFixtures: readonly ComponentFixture[] = [
  {
    id: 'section-default',
    title: 'Section: default',
    tree: { type: 'buildr/section', children: [{ type: 'test/probe' }] },
  },
  {
    id: 'section-widths',
    title: 'Section: content widths',
    tree: {
      type: 'buildr/section',
      props: { container: s('sm'), ariaLabel: s('Narrow') },
      styles: padded('4rem', '3rem', '1.5rem'),
    },
  },
  {
    id: 'section-landmarks',
    title: 'Section: landmarks',
    tree: {
      type: 'buildr/section',
      props: { as: s('header'), container: s('xl'), ariaLabel: s('Site header') },
    },
  },
  {
    id: 'section-full',
    title: 'Section: full width',
    tree: { type: 'buildr/section', props: { container: s('full') } },
  },
] as const;
