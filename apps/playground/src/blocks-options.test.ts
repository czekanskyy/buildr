import { expect, it } from 'vitest';
import { blockEntries } from './blocks-fixtures.ts';
import { CAPTCHA_TEST_KEY, createBlocksOptions, MAP_TEST_KEY } from './blocks-options.ts';
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

it('keeps captcha fixtures inside forms and the test key outside documents', () => {
  const entries = blockEntries.filter((entry) => entry.of === 'buildr/captcha');
  expect(entries.map((entry) => entry.id)).toEqual([
    'captcha-default',
    'captcha-no-site-key',
    'captcha-invalid-site-key',
    'captcha-auto',
    'captcha-multiple',
  ]);
  expect(JSON.stringify(entries)).not.toContain(CAPTCHA_TEST_KEY);
  for (const entry of entries) {
    expect(entry.tree.type).toBe(
      entry.id === 'captcha-multiple' ? 'buildr/container' : 'buildr/form',
    );
  }
});

it('opts only captcha page fixtures into the published test key, never the canvas', () => {
  for (const mode of ['production', 'preview']) {
    const options = createBlocksOptions(
      parseBlocksRoute(`?entry=captcha-default&captchaKey=1&mode=${mode}`),
    );
    expect(options.platform.captcha).toEqual({
      provider: 'turnstile',
      siteKey: CAPTCHA_TEST_KEY,
      clickToLoad: true,
    });
    expect(options.layoutRef).toBe('pages:blocks');
  }
  for (const search of [
    '?entry=captcha-default',
    '?entry=captcha-no-site-key&captchaKey=1',
    '?entry=captcha-default&captchaKey=1&mode=canvas',
    '?entry=map-default&captchaKey=1',
  ]) {
    expect(createBlocksOptions(parseBlocksRoute(search)).platform).not.toHaveProperty('captcha');
  }
  expect(
    createBlocksOptions(parseBlocksRoute('?entry=captcha-invalid-site-key&captchaKey=1')).platform
      .captcha?.siteKey,
  ).not.toMatch(/^[A-Za-z0-9_-]{1,128}$/);
  expect(
    createBlocksOptions(parseBlocksRoute('?entry=captcha-auto&captchaKey=1')).platform.captcha
      ?.clickToLoad,
  ).toBe(false);
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
