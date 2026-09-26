import { describe, expect, it } from 'vitest';
import { groupByCategory, type PaletteItem } from './catalog.ts';

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
