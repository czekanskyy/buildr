import { describe, expect, it } from 'vitest';
import {
  bind,
  expr,
  isBindingValue,
  isExpressionValue,
  isStaticValue,
  s,
  withTranslation,
} from './helpers.ts';

describe('s', () => {
  it('builds a static value', () => {
    expect(s('hi')).toEqual({ kind: 'static', value: 'hi' });
  });

  it('carries l10n', () => {
    expect(s('hi', { l10n: { pl: 'cześć' } })).toEqual({
      kind: 'static',
      value: 'hi',
      l10n: { pl: 'cześć' },
    });
  });
});

describe('bind', () => {
  it('builds a binding value', () => {
    expect(bind('post.title')).toEqual({ kind: 'binding', path: 'post.title' });
  });

  it('carries format and fallback', () => {
    const value = bind('post.title', {
      format: { type: 'text', transform: 'upper' },
      fallback: 'Untitled',
    });
    expect(value).toEqual({
      kind: 'binding',
      path: 'post.title',
      format: { type: 'text', transform: 'upper' },
      fallback: 'Untitled',
    });
  });
});

describe('expr', () => {
  it('builds a formula expression value', () => {
    expect(expr('1 + 1')).toEqual({ kind: 'expression', expr: '1 + 1' });
  });

  it('carries mode, l10n and fallback', () => {
    const value = expr('Hi {{name}}', {
      mode: 'template',
      l10n: { pl: 'Cześć {{name}}' },
      fallback: 'Hi',
    });
    expect(value).toEqual({
      kind: 'expression',
      expr: 'Hi {{name}}',
      mode: 'template',
      l10n: { pl: 'Cześć {{name}}' },
      fallback: 'Hi',
    });
  });
});

describe('guards', () => {
  it('discriminate by kind', () => {
    const values = [s('a'), bind('a'), expr('a')];
    expect(values.map((v) => isStaticValue(v))).toEqual([true, false, false]);
    expect(values.map((v) => isBindingValue(v))).toEqual([false, true, false]);
    expect(values.map((v) => isExpressionValue(v))).toEqual([false, false, true]);
  });
});

describe('withTranslation', () => {
  it('sets a translation on a static value', () => {
    expect(withTranslation(s('Hello'), 'pl', 'Cześć')).toEqual({
      kind: 'static',
      value: 'Hello',
      l10n: { pl: 'Cześć' },
    });
  });

  it('preserves existing translations', () => {
    const value = s('Hello', { l10n: { pl: 'Cześć' } });
    expect(withTranslation(value, 'fr', 'Bonjour')).toEqual({
      kind: 'static',
      value: 'Hello',
      l10n: { pl: 'Cześć', fr: 'Bonjour' },
    });
  });

  it('sets a translation on a template-mode expression value', () => {
    const value = expr('Hi {{name}}', { mode: 'template' });
    expect(withTranslation(value, 'pl', 'Cześć {{name}}')).toEqual({
      kind: 'expression',
      expr: 'Hi {{name}}',
      mode: 'template',
      l10n: { pl: 'Cześć {{name}}' },
    });
  });

  it('throws for a binding value', () => {
    expect(() => withTranslation(bind('post.title'), 'pl', 'x')).toThrow();
  });

  it('throws for a formula-mode expression value (the default)', () => {
    expect(() => withTranslation(expr('1 + 1'), 'pl', 'x')).toThrow();
  });
});
