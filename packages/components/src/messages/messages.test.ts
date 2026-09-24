import { describe, expect, it } from 'vitest';
import { BUILT_IN_MESSAGES, message } from './index.ts';

describe('message', () => {
  it('prefers the site string, then the locale, then English', () => {
    expect(
      message({ locale: 'en', messages: { 'link.newTab': 'new window' } }, 'link.newTab'),
    ).toBe('new window');
    expect(message({ locale: 'pl', messages: {} }, 'link.newTab')).toBe(
      BUILT_IN_MESSAGES.pl['link.newTab'],
    );
    expect(message({ locale: 'pl-PL', messages: {} }, 'link.newTab')).toBe(
      BUILT_IN_MESSAGES.pl['link.newTab'],
    );
    expect(message({ locale: 'de', messages: {} }, 'link.newTab')).toBe(
      BUILT_IN_MESSAGES.en['link.newTab'],
    );
  });

  it('does not read inherited properties of the site catalog', () => {
    expect(
      message({ locale: 'en', messages: Object.create({ 'link.newTab': 'evil' }) }, 'link.newTab'),
    ).toBe(BUILT_IN_MESSAGES.en['link.newTab']);
    expect(message({ locale: '__proto__', messages: {} }, 'link.newTab')).toBe(
      BUILT_IN_MESSAGES.en['link.newTab'],
    );
  });

  it('has every English key in every locale', () => {
    for (const [locale, catalog] of Object.entries(BUILT_IN_MESSAGES)) {
      expect(Object.keys(catalog).sort(), locale).toEqual(Object.keys(BUILT_IN_MESSAGES.en).sort());
    }
  });
});
