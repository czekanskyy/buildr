import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { FormatContext } from './format.ts';
import { formatValue } from './format.ts';
import type { FormatSpec } from './types.ts';

const en: FormatContext = { locale: 'en', timeZone: 'UTC' };
const pl: FormatContext = { locale: 'pl', timeZone: 'UTC' };

describe('formatValue', () => {
  describe('date', () => {
    it('formats an ISO string with the "iso" style as-is (round-tripped through Date)', () => {
      const result = formatValue('2024-03-15T00:00:00.000Z', { type: 'date', style: 'iso' }, en);
      expect(result).toEqual({ ok: true, value: '2024-03-15T00:00:00.000Z' });
    });

    it('formats an epoch-millis number', () => {
      const result = formatValue(Date.UTC(2024, 2, 15), { type: 'date', style: 'short' }, en);
      expect(result.ok).toBe(true);
    });

    it('formats short/medium/long styles in English', () => {
      const value = '2024-03-15T00:00:00.000Z';
      expect(formatValue(value, { type: 'date', style: 'short' }, en)).toEqual({
        ok: true,
        value: '3/15/24',
      });
      expect(formatValue(value, { type: 'date', style: 'long' }, en)).toEqual({
        ok: true,
        value: 'March 15, 2024',
      });
    });

    it('formats a date in Polish', () => {
      const result = formatValue('2024-03-15T00:00:00.000Z', { type: 'date', style: 'long' }, pl);
      expect(result).toEqual({ ok: true, value: '15 marca 2024' });
    });

    it('rejects a non-date value', () => {
      const result = formatValue(true, { type: 'date', style: 'short' }, en);
      expect(result).toMatchObject({ ok: false, error: { code: 'binding.type-mismatch' } });
    });

    it('rejects an unparsable date string', () => {
      const result = formatValue('not a date', { type: 'date', style: 'short' }, en);
      expect(result).toMatchObject({ ok: false, error: { code: 'binding.type-mismatch' } });
    });

    it('reports an invalid timeZone as a diagnostic instead of throwing', () => {
      const badCtx: FormatContext = { locale: 'en', timeZone: 'Not/AZone' };
      const result = formatValue(
        '2024-03-15T00:00:00.000Z',
        { type: 'date', style: 'short' },
        badCtx,
      );
      expect(result).toMatchObject({ ok: false, error: { code: 'format.invalid-spec' } });
    });
  });

  describe('number', () => {
    it('formats a decimal number in English', () => {
      expect(formatValue(1234.5, { type: 'number' }, en)).toEqual({ ok: true, value: '1,234.5' });
    });

    it('formats a decimal number in Polish', () => {
      const result = formatValue(123_456.5, { type: 'number' }, pl);
      expect(result.ok).toBe(true);
      // Grouping in pl uses a non-breaking space whose exact code point isn't fixed across ICU
      // versions; stripping every non-digit/comma character avoids pinning the test to one.
      // biome-ignore lint/style/noNonNullAssertion: asserted ok above
      expect(result.value!.replace(/[^\d,]/g, '')).toBe('123456,5');
    });

    it('respects minimum/maximum fraction digits', () => {
      const result = formatValue(
        1,
        { type: 'number', minimumFractionDigits: 2, maximumFractionDigits: 2 },
        en,
      );
      expect(result).toEqual({ ok: true, value: '1.00' });
    });

    it('formats a percent', () => {
      const result = formatValue(0.5, { type: 'number', style: 'percent' }, en);
      expect(result).toEqual({ ok: true, value: '50%' });
    });

    it('rejects a non-number value', () => {
      const result = formatValue('12', { type: 'number' }, en);
      expect(result).toMatchObject({ ok: false, error: { code: 'binding.type-mismatch' } });
    });
  });

  describe('currency', () => {
    it('formats USD in English', () => {
      const result = formatValue(19.9, { type: 'currency', currency: 'USD' }, en);
      expect(result).toEqual({ ok: true, value: '$19.90' });
    });

    it('formats PLN in Polish', () => {
      const result = formatValue(19.9, { type: 'currency', currency: 'PLN' }, pl);
      expect(result.ok).toBe(true);
      // biome-ignore lint/style/noNonNullAssertion: asserted ok above
      expect(result.value!).toContain('19,90');
    });

    it('rejects a non-number value', () => {
      const result = formatValue('19.9', { type: 'currency', currency: 'USD' }, en);
      expect(result).toMatchObject({ ok: false, error: { code: 'binding.type-mismatch' } });
    });

    it('reports an invalid currency code as a diagnostic instead of throwing', () => {
      const result = formatValue(1, { type: 'currency', currency: 'NOT_A_CODE' }, en);
      expect(result).toMatchObject({ ok: false, error: { code: 'format.invalid-spec' } });
    });
  });

  describe('text', () => {
    it('uppercases', () => {
      expect(formatValue('hello', { type: 'text', transform: 'upper' }, en)).toEqual({
        ok: true,
        value: 'HELLO',
      });
    });

    it('lowercases', () => {
      expect(formatValue('HELLO', { type: 'text', transform: 'lower' }, en)).toEqual({
        ok: true,
        value: 'hello',
      });
    });

    it('capitalizes', () => {
      expect(formatValue('hello world', { type: 'text', transform: 'capitalize' }, en)).toEqual({
        ok: true,
        value: 'Hello world',
      });
    });

    it('leaves an empty string unchanged when capitalizing', () => {
      expect(formatValue('', { type: 'text', transform: 'capitalize' }, en)).toEqual({
        ok: true,
        value: '',
      });
    });

    it('truncates', () => {
      expect(formatValue('hello world', { type: 'text', truncate: 5 }, en)).toEqual({
        ok: true,
        value: 'hello',
      });
    });

    it('applies transform before truncate', () => {
      expect(
        formatValue('hello world', { type: 'text', transform: 'upper', truncate: 5 }, en),
      ).toEqual({ ok: true, value: 'HELLO' });
    });

    it('passes a plain string through unchanged with no transform/truncate', () => {
      expect(formatValue('hello', { type: 'text' }, en)).toEqual({ ok: true, value: 'hello' });
    });

    it('rejects a non-string value', () => {
      const result = formatValue(42, { type: 'text' }, en);
      expect(result).toMatchObject({ ok: false, error: { code: 'binding.type-mismatch' } });
    });
  });

  it('never throws for arbitrary values and specs', () => {
    const specArbitrary: fc.Arbitrary<FormatSpec> = fc.oneof(
      fc.record({
        type: fc.constant('date' as const),
        style: fc.constantFrom('short', 'medium', 'long', 'iso' as const),
      }),
      fc.record({
        type: fc.constant('number' as const),
        minimumFractionDigits: fc.option(fc.nat({ max: 10 }), { nil: undefined }),
        maximumFractionDigits: fc.option(fc.nat({ max: 10 }), { nil: undefined }),
        style: fc.option(fc.constantFrom('decimal', 'percent' as const), { nil: undefined }),
      }),
      fc.record({ type: fc.constant('currency' as const), currency: fc.string() }),
      fc.record({
        type: fc.constant('text' as const),
        transform: fc.option(fc.constantFrom('upper', 'lower', 'capitalize' as const), {
          nil: undefined,
        }),
        truncate: fc.option(fc.nat({ max: 100 }), { nil: undefined }),
      }),
    );

    fc.assert(
      fc.property(
        fc.jsonValue(),
        specArbitrary,
        fc.constantFrom('en', 'pl'),
        (value, spec, locale) => {
          expect(() =>
            formatValue(value as never, spec, { locale, timeZone: 'UTC' }),
          ).not.toThrow();
        },
      ),
    );
  });
});
