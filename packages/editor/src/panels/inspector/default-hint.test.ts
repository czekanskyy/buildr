import { p } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../messages/index.tsx';
import { formatDefault } from './default-hint.ts';

const tEn = createTranslator('en');
const tPl = createTranslator('pl');

describe('formatDefault', () => {
  it('shows a missing default as none, and a missing file as no file', () => {
    const optional = { ...p.text(), default: null } as unknown as ReturnType<typeof p.text>;
    expect(formatDefault(optional, tPl)).toBe('brak');
    expect(formatDefault(optional, tEn)).toBe('none');
    const media = { ...p.media(), default: null } as unknown as ReturnType<typeof p.media>;
    expect(formatDefault(media, tPl)).toBe('brak pliku');
    expect(formatDefault(media, tEn)).toBe('no file');
    const undef = { ...p.text(), default: undefined } as unknown as ReturnType<typeof p.text>;
    expect(formatDefault(undef, tEn)).toBe('none');
  });

  it('shows booleans as Yes/No', () => {
    expect(formatDefault(p.boolean({ default: false }), tPl)).toBe('Nie');
    expect(formatDefault(p.boolean({ default: true }), tPl)).toBe('Tak');
    expect(formatDefault(p.boolean({ default: false }), tEn)).toBe('No');
    expect(formatDefault(p.boolean({ default: true }), tEn)).toBe('Yes');
  });

  it('shows a select default as its option label', () => {
    const def = p.select({
      options: ['a', 'b'],
      default: 'b',
      optionLabels: { a: 'Alpha', b: 'Beta' },
    });
    expect(formatDefault(def, tEn)).toBe('Beta');
    expect(formatDefault(p.select({ options: [1, 2], default: 2 }), tEn)).toBe('2');
  });

  it('shows numbers and texts, and hides an empty text', () => {
    expect(formatDefault(p.number({ default: 16 }), tEn)).toBe('16');
    expect(formatDefault(p.text({ default: 'Hello' }), tEn)).toBe('Hello');
    expect(formatDefault(p.text({ default: 'Heading' }), tEn, () => 'Nagłówek')).toBe('Nagłówek');
    expect(formatDefault(p.text({ default: '' }), tEn)).toBeUndefined();
  });

  it('hides lists, objects and rich text, and never prints raw values', () => {
    expect(formatDefault(p.list(p.text()), tEn)).toBeUndefined();
    expect(formatDefault(p.object({ a: p.text() }), tEn)).toBeUndefined();
    expect(formatDefault(p.richText(), tEn)).toBeUndefined();
    const weird = { ...p.text(), default: { a: 1 } } as unknown as ReturnType<typeof p.text>;
    expect(formatDefault(weird, tEn)).toBeUndefined();
  });
});
