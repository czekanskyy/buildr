import { describe, expect, it } from 'vitest';
import { type PropDef, p } from './index.ts';
import { validatePropValue } from './validate.ts';

function isValid(def: PropDef, value: unknown): boolean {
  return validatePropValue(def, value).ok;
}

describe('validatePropValue', () => {
  const cases: { name: string; def: PropDef; valid: unknown[]; invalid: unknown[] }[] = [
    {
      name: 'text',
      def: p.text({ maxLength: 5 }),
      valid: ['', 'hello'],
      invalid: [123, 'too long'],
    },
    {
      name: 'textarea',
      def: p.textarea({ maxLength: 5 }),
      valid: ['abc'],
      invalid: [42, 'too long'],
    },
    {
      name: 'richText',
      def: p.richText(),
      valid: [null, 'plain', { root: {} }],
      invalid: [undefined],
    },
    { name: 'number', def: p.number({ min: 1, max: 12 }), valid: [1, 12], invalid: [0, 13, '5'] },
    { name: 'boolean', def: p.boolean(), valid: [true, false], invalid: [0, 'true'] },
    { name: 'select', def: p.select({ options: [1, 2, 3] }), valid: [1, 3], invalid: [4, '1'] },
    { name: 'link', def: p.link(), valid: ['/about', 'https://example.com'], invalid: [42] },
    { name: 'media', def: p.media(), valid: [null, { id: 'abc' }], invalid: [undefined] },
    { name: 'icon', def: p.icon(), valid: ['heart'], invalid: [42] },
    {
      name: 'listSource',
      def: p.listSource(),
      valid: [null, { type: 'binding', path: 'x' }],
      invalid: [undefined],
    },
  ];

  for (const { name, def, valid, invalid } of cases) {
    describe(name, () => {
      for (const value of valid) {
        it(`accepts ${JSON.stringify(value)}`, () => {
          expect(isValid(def, value)).toBe(true);
        });
      }
      for (const value of invalid) {
        it(`rejects ${JSON.stringify(value)}`, () => {
          expect(isValid(def, value)).toBe(false);
        });
      }
    });
  }

  describe('list', () => {
    const def = p.list(p.text(), { min: 1, max: 2 });

    it('accepts an array within bounds whose items all validate', () => {
      expect(isValid(def, ['a', 'b'])).toBe(true);
    });

    it('rejects fewer than min items', () => {
      expect(isValid(def, [])).toBe(false);
    });

    it('rejects more than max items', () => {
      expect(isValid(def, ['a', 'b', 'c'])).toBe(false);
    });

    it("rejects an item that fails its own kind's validator", () => {
      expect(isValid(def, [1])).toBe(false);
    });
  });

  describe('object', () => {
    const def = p.object({ label: p.text(), value: p.number() });

    it('accepts a matching shape', () => {
      expect(isValid(def, { label: 'x', value: 1 })).toBe(true);
    });

    it('rejects a field with the wrong type', () => {
      expect(isValid(def, { label: 'x', value: 'nope' })).toBe(false);
    });

    it('rejects an unknown extra field (strict)', () => {
      expect(isValid(def, { label: 'x', value: 1, extra: true })).toBe(false);
    });
  });

  it('returns a Diagnostic on failure', () => {
    const result = validatePropValue(p.number(), 'nope');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('prop.invalid-value');
      expect(result.error.severity).toBe('error');
      expect(result.error.details).toEqual({ kind: 'number' });
    }
  });
});
