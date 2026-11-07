import { type ComponentMeta, createRegistryMeta, toManifest } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import {
  BLOCK_SECTIONS,
  blockSections,
  filterItems,
  groupByCategory,
  type PaletteItem,
  paletteItems,
} from './catalog.ts';

const item = (category: string): PaletteItem =>
  ({ id: `x/${category}`, kind: 'component', category, label: category }) as unknown as PaletteItem;

describe('category order', () => {
  it('lists layout, content, media, forms, ui, cms; unknown categories go last', () => {
    const groups = groupByCategory(
      ['cms', 'zzz', 'ui', 'forms', 'media', 'content', 'layout'].map(item),
    );
    expect(groups.map((group) => group.category)).toEqual([
      'layout',
      'content',
      'media',
      'forms',
      'ui',
      'cms',
      'zzz',
    ]);
  });
});

describe('block sections', () => {
  const block = (id: string, category = 'ui'): PaletteItem => ({
    ...item(category),
    id,
    haystack: id,
  });

  it('uses explicit mapping order regardless of metadata or input order', () => {
    const blocks = BLOCK_SECTIONS.flatMap(({ types }) => types.map((id) => block(id)));
    const unique = [...new Map(blocks.map((entry) => [entry.id, entry])).values()];
    const groups = blockSections(unique.reverse());
    expect(groups.map((group) => group.category)).toEqual(['layout', 'content', 'media', 'forms']);
    expect(groups.map((group) => group.items.map((entry) => entry.id))).toEqual(
      BLOCK_SECTIONS.map(({ types }) => [...types]),
    );
  });

  it('places fieldset in the former label slot in forms', () => {
    expect(BLOCK_SECTIONS.find(({ section }) => section === 'forms')?.types).toEqual([
      'buildr/form',
      'buildr/input',
      'buildr/textarea',
      'buildr/select',
      'buildr/checkbox',
      'buildr/button',
      'buildr/fieldset',
      'buildr/captcha',
    ]);
  });

  it('lists button in content and forms while search returns it once', () => {
    const blocks = [block('buildr/button')];
    expect(blockSections(blocks).map((group) => group.category)).toEqual(['content', 'forms']);
    expect(filterItems(blocks, 'button')).toHaveLength(1);
  });

  it('skips missing types and appends unmapped blocks by their original category', () => {
    const groups = blockSections([
      block('custom/widget', 'third-party'),
      block('buildr/text'),
      block('buildr/list-item'),
    ]);
    expect(groups.map((group) => group.category)).toEqual(['content', 'ui', 'third-party']);
    expect(groups.flatMap((group) => group.items.map((entry) => entry.id))).toEqual([
      'buildr/text',
      'buildr/list-item',
      'custom/widget',
    ]);
    expect(blockSections([])).toEqual([]);
  });
});

describe('palette visibility', () => {
  it('lists carousel and gallery in media and excludes their non-insertable children', () => {
    const types = [
      'buildr/carousel',
      'buildr/gallery',
      'buildr/carousel-slide',
      'buildr/gallery-item',
    ];
    const components = types.map(
      (type) =>
        ({
          type,
          label: type,
          category: 'media',
          version: 1,
          props: {},
          contentCategories: ['flow'],
          styles: { groups: [] },
          runtime: 'shared',
          capabilities: { insertable: !type.endsWith('-slide') && !type.endsWith('-item') },
        }) as ComponentMeta,
    );
    const palette = paletteItems(
      toManifest(createRegistryMeta({ components, templates: [] })),
    ).components;
    const groups = blockSections(palette);
    expect(groups.map((group) => group.category)).toEqual(['media']);
    expect(groups[0]?.items.map((entry) => entry.id)).toEqual(types.slice(0, 2));
    expect(BLOCK_SECTIONS.flatMap(({ types }) => [...types]) as string[]).not.toContain(
      'buildr/carousel-slide',
    );
    expect(BLOCK_SECTIONS.flatMap(({ types }) => [...types]) as string[]).not.toContain(
      'buildr/gallery-item',
    );
  });
  it('filters hidden types and categories before section grouping and search', () => {
    const components = [
      ['buildr/rich-text', 'content'],
      ['buildr/loop', 'cms'],
      ['buildr/pagination', 'cms'],
      ['custom/cms-block', 'cms'],
      ['custom/widget', 'third-party'],
    ].map(
      ([type, category]) =>
        ({
          type,
          category,
          label: type,
          version: 1,
          props: {},
          contentCategories: ['flow'],
          styles: { groups: [] },
          runtime: 'shared',
        }) as ComponentMeta,
    );
    const manifest = toManifest(createRegistryMeta({ components, templates: [] }));
    const palette = paletteItems(manifest).components;
    expect(blockSections(palette).map((group) => group.category)).toEqual(['third-party']);
    expect(palette.map((entry) => entry.id)).toEqual(['custom/widget']);
    for (const query of ['rich-text', 'loop', 'pagination', 'cms-block']) {
      expect(filterItems(palette, query)).toEqual([]);
    }
    expect(filterItems(palette, 'widget').map((entry) => entry.id)).toEqual(['custom/widget']);
    expect(Object.keys(manifest.components)).toHaveLength(5);
  });
});

it('lists Map in media using the registered type', () => {
  const types = BLOCK_SECTIONS.find(({ section }) => section === 'media')?.types;
  expect(types).toContain('buildr/map');
  expect(types).not.toContain('buildr/google-maps');
});
