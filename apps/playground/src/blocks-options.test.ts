import { expect, it } from 'vitest';
import { blockEntries } from './blocks-fixtures.ts';
import { createBlocksOptions, MAP_TEST_KEY } from './blocks-options.ts';
import { parseBlocksRoute } from './blocks-route.ts';

it('exposes every Map fixture once without keys in documents', () => {
  const entries = blockEntries.filter((e) => e.of === 'buildr/map');
  expect(entries.map((e) => e.id)).toEqual([
    'map-default',
    'map-satellite',
    'map-unicode',
    'map-no-key',
    'map-bound',
  ]);
  expect(JSON.stringify(entries)).not.toContain(MAP_TEST_KEY);
});
it('provides the fake key only to the explicitly opted-in production frame', () => {
  expect(MAP_TEST_KEY).toHaveLength(39);
  expect(MAP_TEST_KEY).toMatch(/^[A-Za-z0-9_-]{20,128}$/);
  const enabled = createBlocksOptions(parseBlocksRoute('?entry=map-default&mapKey=1'));
  expect(enabled.platform.maps?.apiKey).toBe(MAP_TEST_KEY);
  expect(enabled.capabilities?.iframeHosts).toEqual(['www.google.com']);
  for (const search of [
    '?entry=map-default',
    '?entry=map-no-key&mapKey=1',
    '?entry=map-default&mapKey=1&mode=canvas',
  ]) {
    expect(createBlocksOptions(parseBlocksRoute(search)).platform).not.toHaveProperty('maps');
  }
  expect(
    createBlocksOptions(parseBlocksRoute('?entry=iframe-default')).capabilities,
  ).toBeUndefined();
});
