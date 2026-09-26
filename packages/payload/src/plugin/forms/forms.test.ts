import type { FormSchema } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { isAllowedRecipient } from './notify.ts';
import { createMemoryRateLimiter } from './rate-limit.ts';
import { validateSubmission } from './validate.ts';

const schema = (fields: FormSchema['fields']): FormSchema => ({ formId: 'form000001', fields });
const field = (
  name: string,
  valueType: FormSchema['fields'][number]['valueType'],
  extra: Partial<FormSchema['fields'][number]> = {},
) => ({ nodeId: 'field00001', name, valueType, required: false, ...extra });

describe('validateSubmission', () => {
  it('checks every value type', () => {
    const result = validateSubmission(
      schema([
        field('n', 'number'),
        field('u', 'url'),
        field('t', 'tel'),
        field('b', 'boolean'),
        field('e', 'enum', { options: ['a', 'b'] }),
      ]),
      { n: '4.5', u: 'https://example.com/x', t: '+48 600 100 200', b: 'off', e: 'a' },
    );
    expect(result).toEqual({
      ok: true,
      data: { n: 4.5, u: 'https://example.com/x', t: '+48 600 100 200', b: false, e: 'a' },
    });

    const bad = validateSubmission(
      schema([
        field('n', 'number'),
        field('u', 'url'),
        field('t', 'tel'),
        field('e', 'enum', { options: ['a'] }),
      ]),
      { n: 'abc', u: 'javascript:alert(1)', t: 'call me', e: ['a'] },
    );
    expect(bad).toEqual({
      ok: false,
      errors: [
        { field: 'n', code: 'invalid' },
        { field: 'u', code: 'invalid' },
        { field: 't', code: 'invalid' },
        { field: 'e', code: 'invalid' },
      ],
    });
  });

  it('omits an empty optional field and requires a required one', () => {
    const fields = [field('a', 'string'), field('b', 'string', { required: true })];
    expect(validateSubmission(schema(fields), { a: '  ', b: ' x ' })).toEqual({
      ok: true,
      data: { b: 'x' },
    });
    expect(validateSubmission(schema(fields), { a: 'x' })).toEqual({
      ok: false,
      errors: [{ field: 'b', code: 'required' }],
    });
  });

  it('requires a required checkbox to be ticked', () => {
    const fields = [field('c', 'boolean', { required: true })];
    expect(validateSubmission(schema(fields), {}).ok).toBe(false);
    expect(validateSubmission(schema(fields), { c: 'on' }).ok).toBe(true);
    expect(validateSubmission(schema(fields), { c: 'maybe' }).ok).toBe(false);
  });

  it('does not read inherited properties as values', () => {
    const result = validateSubmission(
      schema([field('toString', 'string', { required: true })]),
      {},
    );
    expect(result.ok).toBe(false);
  });

  it('limits an unlimited text field', () => {
    expect(validateSubmission(schema([field('a', 'string')]), { a: 'x'.repeat(5001) }).ok).toBe(
      false,
    );
  });
});

describe('createMemoryRateLimiter', () => {
  it('allows the limit per window, then refuses until the window ends', () => {
    let now = 0;
    const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    expect(limiter.hit('a')).toEqual({ allowed: true });
    expect(limiter.hit('a')).toEqual({ allowed: true });
    expect(limiter.hit('a')).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.hit('b')).toEqual({ allowed: true });
    now = 1000;
    expect(limiter.hit('a')).toEqual({ allowed: true });
  });

  it('keeps no state between limiters', () => {
    const one = createMemoryRateLimiter({ limit: 1, windowMs: 1000 });
    const two = createMemoryRateLimiter({ limit: 1, windowMs: 1000 });
    one.hit('k');
    expect(two.hit('k')).toEqual({ allowed: true });
  });
});

describe('isAllowedRecipient', () => {
  it('matches exact addresses and domains, ignoring case', () => {
    const list = ['ops@example.com', '@team.example'];
    expect(isAllowedRecipient('OPS@example.com', list)).toBe(true);
    expect(isAllowedRecipient('anyone@team.example', list)).toBe(true);
    expect(isAllowedRecipient('other@example.com', list)).toBe(false);
    expect(isAllowedRecipient('x@evil-team.example', list)).toBe(false);
    expect(isAllowedRecipient('a@team.example, b@evil.example', list)).toBe(false);
  });
});
