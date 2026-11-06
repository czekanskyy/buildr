import { describe, expect, it } from 'vitest';
import { en } from './en.ts';
import { createPluralTranslator, createTranslator, interpolate, UI_LOCALES } from './index.tsx';
import { pl } from './pl.ts';

describe('plurals', () => {
  it('uses Polish deletion plurals', () => {
    const plural = createPluralTranslator('pl');
    expect(plural('toast.deletedCount', 1)).toBe('Usunięto 1 blok');
    expect(plural('toast.deletedCount', 3)).toBe('Usunięto 3 bloki');
    expect(plural('toast.deletedCount', 5)).toBe('Usunięto 5 bloków');
    expect(plural('toast.deletedCount', 22)).toBe('Usunięto 22 bloki');
  });

  it('picks one and other in English', () => {
    const plural = createPluralTranslator('en');
    expect(plural('issues.count.warning', 1)).toBe('1 warning');
    expect(plural('issues.count.warning', 0)).toBe('0 warnings');
    expect(plural('issues.count.warning', 5)).toBe('5 warnings');
  });

  it('picks one, few and many in Polish', () => {
    const plural = createPluralTranslator('pl');
    expect(plural('issues.count.warning', 1)).toBe('1 ostrzeżenie');
    expect(plural('issues.count.warning', 2)).toBe('2 ostrzeżenia');
    expect(plural('issues.count.warning', 4)).toBe('4 ostrzeżenia');
    expect(plural('issues.count.warning', 5)).toBe('5 ostrzeżeń');
    expect(plural('issues.count.warning', 12)).toBe('12 ostrzeżeń');
    expect(plural('issues.count.warning', 22)).toBe('22 ostrzeżenia');
    expect(plural('blocks.results', 3)).toBe('3 wyniki');
  });

  it('falls back to English for an unknown language', () => {
    expect(createPluralTranslator('xx')('issues.count.error', 2)).toBe('2 errors');
    expect(createPluralTranslator('pl-PL')('issues.count.error', 2)).toBe('2 błędy');
  });

  it('fills placeholders literally', () => {
    expect(interpolate('{a} and {b} {c}', { a: '$&', b: 2 })).toBe('$& and 2 {c}');
  });

  it('keeps both catalogs in step, with every plural form present', () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
    expect(UI_LOCALES).toEqual(['en', 'pl']);
    const bases = Object.keys(en)
      .filter((key) => key.endsWith('.other'))
      .map((key) => key.slice(0, -'.other'.length));
    expect(bases.length).toBeGreaterThan(5);
    for (const base of bases) {
      for (const form of ['one', 'few', 'many', 'other']) {
        expect(Object.hasOwn(en, `${base}.${form}`), `${base}.${form}`).toBe(true);
      }
    }
    expect(createTranslator('pl')('toast.undo')).toBe('Cofnij');
  });
});
