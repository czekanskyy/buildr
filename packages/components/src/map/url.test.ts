import { expect, it } from 'vitest';
import { checkExternalUrl } from '../media/external.ts';
import { buildMapUrls, clampZoom, normalizeMapType, normalizeQuery } from './url.ts';

const apiKey = 'K'.repeat(39);
it('builds exact URLs', () => {
  const q = 'Rynek%20G%C5%82%C3%B3wny%201%2C%20Krak%C3%B3w';
  expect(
    buildMapUrls({
      query: 'Rynek Główny 1, Kraków',
      zoom: 15,
      mapType: 'roadmap',
      locale: 'pl',
      apiKey,
    }),
  ).toEqual({
    kind: 'frame',
    query: 'Rynek Główny 1, Kraków',
    linkUrl: `https://www.google.com/maps/search/?api=1&query=${q}`,
    frameUrl: `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${q}&zoom=15&maptype=roadmap&language=pl`,
  });
});
it.each(['& # ? = + % " <', 'a\nb', '🗺️😀'])('safely encodes %s', (query) => {
  expect(() => buildMapUrls({ query, apiKey })).not.toThrow();
  const result = buildMapUrls({ query, apiKey });
  if (result.kind !== 'nothing')
    expect(result.linkUrl).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizeQuery(query) ?? '')}`,
    );
});
it('normalizes limits and controls', () => {
  expect(normalizeQuery(' a\n  b\u0000 ')).toBe('a b');
  expect(normalizeQuery('😀'.repeat(257))).toBeUndefined();
  expect(normalizeQuery('😀'.repeat(256))).toHaveLength(512);
  expect(buildMapUrls({ query: '中'.repeat(256), apiKey })).toEqual({ kind: 'nothing' });
  expect(normalizeQuery('')).toBeUndefined();
});
it.each([
  [-1, 0],
  [22, 21],
  [14.6, 15],
  [NaN, 15],
])('clamps %s', (input, output) => expect(clampZoom(input)).toBe(output));
it('defaults invalid map type and omits invalid locale', () => {
  expect(normalizeMapType('bad')).toBe('roadmap');
  const result = buildMapUrls({ query: 'Paris', apiKey, locale: 'bad_locale' });
  expect(result.kind === 'frame' && result.frameUrl.includes('language=')).toBe(false);
});
it.each([
  [[], 'link'],
  [['youtube.com'], 'link'],
  [['google.com'], 'frame'],
] as const)('checks hosts %j', (iframeHosts, kind) =>
  expect(buildMapUrls({ query: 'Paris', apiKey, iframeHosts }).kind).toBe(kind),
);

it('fails closed when the numeric-entity sanitizer throws', () => {
  const query = '&#99999999;';
  const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  expect(() => checkExternalUrl(link)).toThrow(RangeError);
  expect(buildMapUrls({ query, apiKey })).toEqual({ kind: 'nothing' });
});
it('replaces a lone surrogate with U+FFFD before encoding', () => {
  expect(() => buildMapUrls({ query: 'a\ud800b', apiKey })).not.toThrow();
  expect(buildMapUrls({ query: 'a\ud800b', apiKey })).toEqual({
    kind: 'frame',
    query: 'a\ufffdb',
    linkUrl: 'https://www.google.com/maps/search/?api=1&query=a%EF%BF%BDb',
    frameUrl: `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=a%EF%BF%BDb&zoom=15&maptype=roadmap`,
  });
});
