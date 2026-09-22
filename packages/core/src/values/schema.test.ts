import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatSpecSchema, valueSchema } from './schema.ts';
import type { Value } from './types.ts';

describe('valueSchema', () => {
  const schema = valueSchema(z.string());

  it('accepts a static value', () => {
    expect(schema.safeParse({ kind: 'static', value: 'hi' }).success).toBe(true);
  });

  it('accepts a static value with l10n', () => {
    const result = schema.safeParse({ kind: 'static', value: 'hi', l10n: { pl: 'cześć' } });
    expect(result.success).toBe(true);
  });

  it('accepts a binding value', () => {
    expect(schema.safeParse({ kind: 'binding', path: 'post.title' }).success).toBe(true);
  });

  it('accepts a binding value with format and fallback', () => {
    const result = schema.safeParse({
      kind: 'binding',
      path: 'post.title',
      format: { type: 'text', transform: 'upper' },
      fallback: 'Untitled',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a formula-mode expression value (the default)', () => {
    expect(schema.safeParse({ kind: 'expression', expr: '1 + 1' }).success).toBe(true);
    expect(schema.safeParse({ kind: 'expression', expr: '1 + 1', mode: 'formula' }).success).toBe(
      true,
    );
  });

  it('accepts a template-mode expression value with l10n', () => {
    const result = schema.safeParse({
      kind: 'expression',
      expr: 'Hello {{name}}',
      mode: 'template',
      l10n: { pl: 'Cześć {{name}}' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown kind', () => {
    expect(schema.safeParse({ kind: 'computed', value: 'x' }).success).toBe(false);
  });

  it('rejects l10n on a formula-mode expression value (implicit default mode)', () => {
    const result = schema.safeParse({ kind: 'expression', expr: '1 + 1', l10n: { pl: 'x' } });
    expect(result.success).toBe(false);
  });

  it('rejects l10n on an explicit formula-mode expression value', () => {
    const result = schema.safeParse({
      kind: 'expression',
      expr: '1 + 1',
      mode: 'formula',
      l10n: { pl: 'x' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects l10n on a binding value (no such field)', () => {
    const result = schema.safeParse({ kind: 'binding', path: 'post.title', l10n: { pl: 'x' } });
    expect(result.success).toBe(false);
  });

  it('rejects extra keys (strict)', () => {
    expect(schema.safeParse({ kind: 'static', value: 'hi', extra: true }).success).toBe(false);
  });

  it('rejects a static value that fails the inner schema', () => {
    expect(schema.safeParse({ kind: 'static', value: 42 }).success).toBe(false);
  });

  it('rejects a binding fallback that fails the inner schema', () => {
    const result = schema.safeParse({ kind: 'binding', path: 'post.title', fallback: 42 });
    expect(result.success).toBe(false);
  });

  it('round-trips through JSON', () => {
    const values: Value<string>[] = [
      { kind: 'static', value: 'hi', l10n: { pl: 'cześć' } },
      { kind: 'binding', path: 'post.title', fallback: 'Untitled' },
      { kind: 'expression', expr: 'Hi {{name}}', mode: 'template', l10n: { pl: 'x' } },
    ];
    for (const value of values) {
      expect(schema.safeParse(JSON.parse(JSON.stringify(value))).success).toBe(true);
    }
  });
});

describe('formatSpecSchema', () => {
  const valid = [
    { type: 'date', style: 'short' },
    { type: 'number', minimumFractionDigits: 2, maximumFractionDigits: 4, style: 'decimal' },
    { type: 'currency', currency: 'PLN' },
    { type: 'text', transform: 'upper', truncate: 10 },
  ];

  for (const spec of valid) {
    it(`accepts ${JSON.stringify(spec)}`, () => {
      expect(formatSpecSchema.safeParse(spec).success).toBe(true);
    });
  }

  it('rejects an unknown type', () => {
    expect(formatSpecSchema.safeParse({ type: 'unknown' }).success).toBe(false);
  });

  it('rejects extra keys (strict)', () => {
    expect(
      formatSpecSchema.safeParse({ type: 'currency', currency: 'PLN', extra: 1 }).success,
    ).toBe(false);
  });
});
