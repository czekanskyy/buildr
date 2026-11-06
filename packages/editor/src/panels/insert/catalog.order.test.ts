import { describe, expect, it } from 'vitest';
import {
  BLOCK_SECTIONS,
  blockSections,
  filterItems,
  groupByCategory,
  type PaletteItem,
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

  it('lists button in content and forms while search returns it once', () => {
    const blocks = [block('buildr/button')];
    expect(blockSections(blocks).map((group) => group.category)).toEqual(['content', 'forms']);
    expect(filterItems(blocks, 'button')).toHaveLength(1);
  });

  it('skips missing types and appends unmapped blocks by their original category', () => {
    const groups = blockSections([
      block('custom/widget', 'third-party'),
      block('buildr/loop', 'cms'),
      block('buildr/text'),
      block('buildr/list-item'),
      block('buildr/pagination', 'cms'),
    ]);
    expect(groups.map((group) => group.category)).toEqual(['content', 'ui', 'cms', 'third-party']);
    expect(groups.flatMap((group) => group.items.map((entry) => entry.id))).toEqual([
      'buildr/text',
      'buildr/list-item',
      'buildr/loop',
      'buildr/pagination',
      'custom/widget',
    ]);
    expect(blockSections([])).toEqual([]);
  });
});
