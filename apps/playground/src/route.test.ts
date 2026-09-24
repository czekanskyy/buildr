import { describe, expect, it } from 'vitest';
import { galleryHref, parseGalleryRoute } from './route.ts';

describe('parseGalleryRoute', () => {
  it('reads the fixture and the width', () => {
    expect(parseGalleryRoute('?fixture=hello&w=375')).toEqual({ fixture: 'hello', width: 375 });
  });

  it('shows the index without a fixture', () => {
    expect(parseGalleryRoute('')).toEqual({ fixture: undefined, width: undefined });
    expect(parseGalleryRoute('?fixture=')).toEqual({ fixture: undefined, width: undefined });
  });

  it.each(['abc', '-5', '10', '99999', '1e3', '375px', ''])('ignores the width %j', (w) => {
    expect(parseGalleryRoute(`?w=${w}`).width).toBeUndefined();
  });
});

describe('galleryHref', () => {
  it('round-trips', () => {
    expect(galleryHref({})).toBe('/gallery');
    expect(
      parseGalleryRoute(galleryHref({ fixture: 'a b', width: 768 }).split('?')[1] ?? ''),
    ).toEqual({
      fixture: 'a b',
      width: 768,
    });
  });
});
