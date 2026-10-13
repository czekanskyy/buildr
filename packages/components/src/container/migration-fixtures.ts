// Stored documents from before container version 2 and what loading them must produce
// (docs/migrations.md#component-migrations, ADR-025). Ids are pinned so `after` can be written by hand.
import { type BuilderDocument, bind, s } from '@next-buildr/core';
import { doc, type NodeTree } from '@next-buildr/test-utils';

export interface ContainerMigrationFixture {
  readonly id: string;
  readonly title: string;
  readonly before: BuilderDocument;
  readonly after: BuilderDocument;
}

/** Document node ids are ten letters or digits. */
export const nid = (name: string): string => name.padEnd(10, '0');

const probe = (id: string): NodeTree => ({ id: nid(id), type: 'test/probe' });
const media = (id: string) => s({ source: 'fixtures', collection: 'media', id });

const beforeComponents = (types: readonly string[]) =>
  Object.fromEntries(types.map((type) => [type, 1]));

function pair(
  id: string,
  title: string,
  retired: string,
  before: NodeTree,
  after: NodeTree,
): ContainerMigrationFixture {
  return {
    id,
    title,
    before: doc(
      { children: [before] },
      { components: { ...beforeComponents([retired, 'buildr/page', 'test/probe']) } },
    ),
    after: doc(
      { children: [after] },
      { components: { 'buildr/container': 2, 'buildr/page': 1, 'test/probe': 1 } },
    ),
  };
}

/** A migrated stack or section: always a flex column in these fixtures. */
const flex = { display: s('flex') };

export const containerMigrationFixtures: readonly ContainerMigrationFixture[] = [
  pair(
    'container-1-to-2',
    'Container 1 -> 2: stays a block',
    'buildr/container',
    {
      id: nid('c'),
      type: 'buildr/container',
      props: { width: s('md') },
      children: [probe('p')],
    },
    {
      id: nid('c'),
      type: 'buildr/container',
      props: { width: s('md'), display: s('block') },
      children: [probe('p')],
    },
  ),
  pair(
    'stack-to-container',
    'Stack -> container: a named group',
    'buildr/stack',
    {
      id: nid('s'),
      type: 'buildr/stack',
      props: { role: s('group'), ariaLabel: s('Contact options') },
      styles: { base: { layout: { direction: 'row', gap: '1rem' } } },
      children: [probe('p1'), probe('p2')],
    },
    {
      id: nid('s'),
      type: 'buildr/container',
      props: {
        role: s('group'),
        ariaLabel: s('Contact options'),
        ...flex,
        as: s('div'),
        width: s('none'),
      },
      styles: { base: { layout: { direction: 'row', gap: '1rem' } } },
      children: [probe('p1'), probe('p2')],
    },
  ),
  pair(
    'stack-defaults-to-container',
    'Stack -> container: a stack without props',
    'buildr/stack',
    { id: nid('s'), type: 'buildr/stack', children: [probe('p')] },
    {
      id: nid('s'),
      type: 'buildr/container',
      props: { ...flex, as: s('div'), width: s('none') },
      children: [probe('p')],
    },
  ),
  pair(
    'section-default-to-container',
    'Section -> container: defaults (lg, no gap)',
    'buildr/section',
    { id: nid('x'), type: 'buildr/section', children: [probe('p')] },
    {
      id: nid('x'),
      type: 'buildr/container',
      props: { ...flex, as: s('section'), width: s('lg'), bleed: s(true) },
      styles: { base: { layout: { gap: '0' } } },
      children: [probe('p')],
    },
  ),
  pair(
    'section-full-to-container',
    'Section -> container: full width',
    'buildr/section',
    { id: nid('x'), type: 'buildr/section', props: { container: s('full') } },
    {
      id: nid('x'),
      type: 'buildr/container',
      props: { ...flex, as: s('section'), width: s('none'), bleed: s(true) },
      styles: { base: { layout: { gap: '0' } } },
    },
  ),
  pair(
    'section-main-to-container',
    'Section -> container: main, xl, localised name',
    'buildr/section',
    {
      id: nid('x'),
      type: 'buildr/section',
      props: {
        as: s('main'),
        container: s('xl'),
        ariaLabel: s('Main', { l10n: { pl: 'Glowna' } }),
      },
    },
    {
      id: nid('x'),
      type: 'buildr/container',
      props: {
        ...flex,
        as: s('main'),
        width: s('xl'),
        bleed: s(true),
        ariaLabel: s('Main', { l10n: { pl: 'Glowna' } }),
      },
      styles: { base: { layout: { gap: '0' } } },
    },
  ),
  pair(
    'section-static-image-to-container',
    'Section -> container: static background image',
    'buildr/section',
    {
      id: nid('x'),
      type: 'buildr/section',
      props: { backgroundImage: media('m1') as never, container: s('sm') },
    },
    {
      id: nid('x'),
      type: 'buildr/container',
      props: {
        ...flex,
        as: s('section'),
        width: s('sm'),
        bleed: s(true),
        backgroundImage: media('m1') as never,
      },
      styles: { base: { layout: { gap: '0' } } },
    },
  ),
  pair(
    'section-bound-image-to-container',
    'Section -> container: bound background image',
    'buildr/section',
    {
      id: nid('x'),
      type: 'buildr/section',
      props: { backgroundImage: bind('post.cover') as never },
    },
    {
      id: nid('x'),
      type: 'buildr/container',
      props: {
        ...flex,
        as: s('section'),
        width: s('lg'),
        bleed: s(true),
        backgroundImage: bind('post.cover') as never,
      },
      styles: { base: { layout: { gap: '0' } } },
    },
  ),
] as const;
