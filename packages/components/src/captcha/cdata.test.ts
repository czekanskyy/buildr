import { expect, it } from 'vitest';
import { captchaCData } from './cdata.ts';
import {
  CAPTCHA_ACTION,
  CAPTCHA_FIELD,
  CAPTCHA_SITE_KEY_REGEX,
  CAPTCHA_TYPE,
  TURNSTILE_SCRIPT_URL,
} from './constants.ts';

// Independently computed with node:crypto; identical to the payload golden vectors.
const SIMPLE = '39d82018d38dd1145f9903261b443a1556acf5f672cc5a15e8fa61999b15d6bd';
const UNICODE = 'ea58a41440286e8b7194961ae8b63704e6ceca9e305a190cf7637bc8d6dc4cc5';
it.each([
  ['pages:1', 'form000001', SIMPLE],
  ['pages:za\u017c\u00f3\u0142\u0107-\u6771\u4eac', 'formularz-\u{1f6e1}\ufe0f', UNICODE],
])('binds the UTF-8 canonical layout %s to form %s', async (ref, id, expected) => {
  expect(await captchaCData(ref, id)).toBe(expected);
});
it('pins the reserved field, action, type, exact script URL and site-key grammar', () => {
  expect([CAPTCHA_FIELD, CAPTCHA_ACTION, CAPTCHA_TYPE, TURNSTILE_SCRIPT_URL]).toEqual([
    'buildr-captcha',
    'buildr_form',
    'buildr/captcha',
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  ]);
  for (const value of ['a', 'A_0-', 'a'.repeat(128)])
    expect(CAPTCHA_SITE_KEY_REGEX.test(value)).toBe(true);
  for (const value of ['', 'a'.repeat(129), 'a b', '\u0105\u0107', 'a/b', 'x\n'])
    expect(CAPTCHA_SITE_KEY_REGEX.test(value)).toBe(false);
});
it('distinguishes form and layout identities without delimiter ambiguity', async () => {
  const inputs = [
    ['pages:1', 'a'],
    ['pages:1', 'b'],
    ['pages:2', 'a'],
    ['a,b', 'c'],
    ['a', 'b,c'],
  ];
  expect(
    new Set(await Promise.all(inputs.map(([ref, id]) => captchaCData(ref ?? '', id ?? '')))).size,
  ).toBe(inputs.length);
});
