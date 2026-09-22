import { describe, expect, it } from 'vitest';
import type { Result } from './result.ts';
import { err, ok } from './result.ts';

describe('Result', () => {
  it('ok() produces a success result', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('err() produces a failure result', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });

  it('narrows on the ok discriminant', () => {
    const result: Result<number, string> = ok(1);
    if (result.ok) {
      expect(result.value).toBe(1);
    } else {
      throw new Error('expected an ok result');
    }
  });

  it('narrows on the err branch', () => {
    const result: Result<number, string> = err('nope');
    if (!result.ok) {
      expect(result.error).toBe('nope');
    } else {
      throw new Error('expected an err result');
    }
  });
});
