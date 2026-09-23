import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { JsonValue } from '../json/json-value.ts';
import type { CoercibleKind } from './coerce.ts';
import { coerceValue } from './coerce.ts';
import type { FormatContext } from './format.ts';
import { plainTextToRichText } from './richtext.ts';

const en: FormatContext = { locale: 'en', timeZone: 'UTC' };

describe('coerceValue', () => {
  describe('text', () => {
    it('passes a string through unchanged with no format', () => {
      expect(coerceValue('hello', 'text', en)).toEqual({ value: 'hello', diagnostics: [] });
    });

    it('applies an explicit format to a string', () => {
      const result = coerceValue('hello', 'text', en, { type: 'text', transform: 'upper' });
      expect(result).toEqual({ value: 'HELLO', diagnostics: [] });
    });

    it('formats a number with the default Intl format when no format is given', () => {
      expect(coerceValue(1234.5, 'text', en)).toEqual({ value: '1,234.5', diagnostics: [] });
    });

    it('formats a number through an explicit format', () => {
      const result = coerceValue(19.9, 'text', en, { type: 'currency', currency: 'USD' });
      expect(result).toEqual({ value: '$19.90', diagnostics: [] });
    });

    it('formats a date-shaped string only when an explicit date format is given', () => {
      const result = coerceValue('2024-03-15T00:00:00.000Z', 'text', en, {
        type: 'date',
        style: 'short',
      });
      expect(result).toEqual({ value: '3/15/24', diagnostics: [] });
    });

    it('reports a type mismatch for a boolean, with no fallback value', () => {
      const result = coerceValue(true, 'text', en);
      expect(result.value).toBeUndefined();
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ code: 'binding.type-mismatch' }),
      ]);
    });

    it('reports a mismatch coming from a bad explicit format instead of throwing', () => {
      const result = coerceValue('hello', 'text', en, { type: 'number' });
      expect(result.value).toBeUndefined();
      expect(result.diagnostics[0]?.code).toBe('binding.type-mismatch');
    });
  });

  describe('link', () => {
    it('sanitizes a safe URL', () => {
      expect(coerceValue('https://example.com', 'link', en)).toEqual({
        value: 'https://example.com',
        diagnostics: [],
      });
    });

    it('rejects an unsafe URL scheme', () => {
      const result = coerceValue('javascript:alert(1)', 'link', en);
      expect(result.value).toBeUndefined();
      expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'url.unsafe-scheme' })]);
    });

    it('reports a type mismatch for a non-string value', () => {
      const result = coerceValue(42, 'link', en);
      expect(result.value).toBeUndefined();
      expect(result.diagnostics[0]?.code).toBe('binding.type-mismatch');
    });
  });

  describe('richText', () => {
    it('wraps a plain string into a single paragraph', () => {
      const result = coerceValue('Hello world', 'richText', en);
      expect(result).toEqual({ value: plainTextToRichText('Hello world'), diagnostics: [] });
    });

    it('normalizes an already rich-text-shaped value, dropping unknown nodes', () => {
      const value: JsonValue = {
        type: 'root',
        version: 1,
        children: [{ type: 'unknown-block', version: 1, children: [] }],
      };
      const result = coerceValue(value, 'richText', en);
      expect(result.value).toEqual({ type: 'root', version: 1, children: [] });
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ code: 'richtext.unknown-node' }),
      ]);
    });

    it('never fails outright for a garbage value (falls back to an empty root)', () => {
      const result = coerceValue(42, 'richText', en);
      expect(result.value).toEqual({ type: 'root', version: 1, children: [] });
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ code: 'richtext.invalid-root' }),
      ]);
    });
  });

  describe('boolean', () => {
    it('passes a boolean through unchanged', () => {
      expect(coerceValue(true, 'boolean', en)).toEqual({ value: true, diagnostics: [] });
      expect(coerceValue(false, 'boolean', en)).toEqual({ value: false, diagnostics: [] });
    });

    it('reports a type mismatch for anything else', () => {
      const result = coerceValue('true', 'boolean', en);
      expect(result.value).toBeUndefined();
      expect(result.diagnostics[0]?.code).toBe('binding.type-mismatch');
    });
  });

  describe('number', () => {
    it('passes a number through unchanged', () => {
      expect(coerceValue(42, 'number', en)).toEqual({ value: 42, diagnostics: [] });
    });

    it('reports a type mismatch for a numeric string', () => {
      const result = coerceValue('42', 'number', en);
      expect(result.value).toBeUndefined();
      expect(result.diagnostics[0]?.code).toBe('binding.type-mismatch');
    });
  });

  describe('media', () => {
    it('passes any value through untouched', () => {
      const value: JsonValue = { id: 'm1', url: 'https://example.com/a.png' };
      expect(coerceValue(value, 'media', en)).toEqual({ value, diagnostics: [] });
    });
  });

  describe('listSource', () => {
    it('passes any value through untouched', () => {
      const value: JsonValue = [1, 2, 3];
      expect(coerceValue(value, 'listSource', en)).toEqual({ value, diagnostics: [] });
    });
  });

  it('never throws for arbitrary values and kinds', () => {
    const kinds: readonly CoercibleKind[] = [
      'text',
      'link',
      'media',
      'richText',
      'boolean',
      'number',
      'listSource',
    ];

    fc.assert(
      fc.property(fc.jsonValue(), fc.constantFrom(...kinds), (value, kind) => {
        expect(() => coerceValue(value as JsonValue, kind, en)).not.toThrow();
      }),
    );
  });
});
