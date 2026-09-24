import { type ComponentType, createMemoryDataSource, s, type TreeNode } from '@buildr/core';
import { accordionFixtures } from './accordion/fixtures.ts';
import { accordionItemFixtures } from './accordion-item/fixtures.ts';
import { badgeFixtures } from './badge/fixtures.ts';
import { buttonFixtures } from './button/fixtures.ts';
import { cardFixtures } from './card/fixtures.ts';
import { checkboxFixtures } from './checkbox/fixtures.ts';
import { containerFixtures } from './container/fixtures.ts';
import { dividerFixtures } from './divider/fixtures.ts';
import type { ComponentFixture } from './fixtures.ts';
import { formFixtures } from './form/fixtures.ts';
import { gridFixtures } from './grid/fixtures.ts';
import { headingFixtures } from './heading/fixtures.ts';
import { iconFixtures } from './icon/fixtures.ts';
import { imageFixtureMedia, imageFixtures } from './image/fixtures.ts';
import { inputFixtures } from './input/fixtures.ts';
import { linkFixtures } from './link/fixtures.ts';
import { listFixtures } from './list/fixtures.ts';
import { listItemFixtures } from './list-item/fixtures.ts';
import { loopFixtures } from './loop/fixtures.ts';
import { pageFixtures } from './page/fixtures.ts';
import { paginationFixtures } from './pagination/fixtures.ts';
import { richTextFixtures } from './rich-text/fixtures.ts';
import { sectionFixtures } from './section/fixtures.ts';
import { selectFixtures } from './select/fixtures.ts';
import { stackFixtures } from './stack/fixtures.ts';
import { contentTemplateFixtures, marketingTemplateFixtures } from './templates/fixtures.ts';
import { templateSampleCollections, templateSampleScopes } from './templates/sample-data.ts';
import { textFixtures } from './text/fixtures.ts';
import { textareaFixtures } from './textarea/fixtures.ts';

/** One thing to look at in the gallery: a component in one state, or a template. */
export interface GalleryEntry extends ComponentFixture {
  readonly group: 'component' | 'template';
  /** The component type, or the template id, the entry shows. */
  readonly of: ComponentType;
}

/** The fixtures use a stand-in leaf (`test/probe`) for content; the gallery shows a real one. */
function withoutProbes(node: TreeNode): TreeNode {
  if (node.type === 'test/probe') {
    return { type: 'buildr/text', props: { text: s('Content') } as never };
  }
  const slots = node.slots
    ? Object.fromEntries(
        Object.entries(node.slots).map(([name, children]) => [name, children.map(withoutProbes)]),
      )
    : undefined;
  return {
    ...node,
    ...(node.children ? { children: node.children.map(withoutProbes) } : {}),
    ...(slots ? { slots } : {}),
  };
}

const componentFixtures: readonly (readonly [ComponentType, readonly ComponentFixture[]])[] = [
  ['buildr/page', pageFixtures],
  ['buildr/section', sectionFixtures],
  ['buildr/container', containerFixtures],
  ['buildr/stack', stackFixtures],
  ['buildr/grid', gridFixtures],
  ['buildr/heading', headingFixtures],
  ['buildr/text', textFixtures],
  ['buildr/rich-text', richTextFixtures],
  ['buildr/button', buttonFixtures],
  ['buildr/link', linkFixtures],
  ['buildr/image', imageFixtures],
  ['buildr/icon', iconFixtures],
  ['buildr/list', listFixtures],
  ['buildr/list-item', listItemFixtures],
  ['buildr/divider', dividerFixtures],
  ['buildr/badge', badgeFixtures],
  ['buildr/card', cardFixtures],
  ['buildr/accordion', accordionFixtures],
  ['buildr/accordion-item', accordionItemFixtures],
  ['buildr/loop', loopFixtures],
  ['buildr/pagination', paginationFixtures],
  ['buildr/form', formFixtures],
  ['buildr/input', inputFixtures],
  ['buildr/textarea', textareaFixtures],
  ['buildr/select', selectFixtures],
  ['buildr/checkbox', checkboxFixtures],
];

/** The template a fixture shows: its id is `template-<name>` with an optional `-<variant>`. */
const templateOf = (fixture: ComponentFixture): ComponentType =>
  `buildr/${fixture.id.replace(/^template-/, '').replace(/-(imageRight|centered)$/, '')}`;

/**
 * Every component in each of its states, then every template and variant. Each entry is a subtree
 * to put under a page and view at the widths of `FIXTURE_WIDTHS`; render them with
 * `createGalleryDataSource()` and `gallerySampleScopes`.
 */
export const galleryEntries: readonly GalleryEntry[] = [
  ...componentFixtures.flatMap(([type, fixtures]) =>
    fixtures.map(
      (fixture): GalleryEntry => ({
        ...fixture,
        tree: withoutProbes(fixture.tree),
        group: 'component',
        of: type,
      }),
    ),
  ),
  ...[...marketingTemplateFixtures, ...contentTemplateFixtures].map(
    (fixture): GalleryEntry => ({ ...fixture, group: 'template', of: templateOf(fixture) }),
  ),
];

/** The data the gallery entries read: the sample posts, and the media the image fixtures name. */
export function createGalleryDataSource() {
  return createMemoryDataSource({
    collections: { ...templateSampleCollections },
    media: imageFixtureMedia,
  });
}

/** The scopes the gallery entries read (`post`, `product`, `route`). */
export const gallerySampleScopes = templateSampleScopes;
