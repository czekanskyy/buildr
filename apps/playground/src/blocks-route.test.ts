import { expect, it } from 'vitest';
import { parseBlocksRoute } from './blocks-route.ts';

it('parses entry, bounded width and explicit static opt-in', () => {
  expect(parseBlocksRoute('?entry=carousel-default&w=375&static=1')).toEqual({
    entry: 'carousel-default',
    width: 375,
    staticMarkup: true,
  });
  expect(parseBlocksRoute('')).toEqual({ entry: undefined, width: undefined, staticMarkup: false });
});
it.each(['abc', '-5', '10', '99999', '1e3', '375px', ''])('ignores invalid width %s', (w) => {
  expect(parseBlocksRoute(`?w=${w}&static=true`).width).toBeUndefined();
  expect(parseBlocksRoute(`?w=${w}&static=true`).staticMarkup).toBe(false);
});

it.each([200, 4000])('accepts the width boundary %s', (width) => {
  expect(parseBlocksRoute(`?entry=a%20b&w=${width}`).width).toBe(width);
  expect(parseBlocksRoute(`?entry=a%20b&w=${width}`).entry).toBe('a b');
});
