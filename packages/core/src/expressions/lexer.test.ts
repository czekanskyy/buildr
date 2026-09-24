import { describe, expect, it } from 'vitest';
import { MAX_EXPRESSION_TOKENS } from './ast.ts';
import { ExpressionSyntaxError, tokenize } from './lexer.ts';

const texts = (source: string) => tokenize(source).map((t) => t.text);

describe('tokenize', () => {
  it('splits punctuation, identifiers, numbers and strings, ending with an end token', () => {
    expect(texts('a.b >= 10 && !c')).toEqual(['a', '.', 'b', '>=', '10', '&&', '!', 'c', '']);
    expect(tokenize('x').at(-1)?.type).toBe('end');
  });

  it('prefers two-character operators', () => {
    expect(texts('a??b||c&&d==e!=f<=g>=h')).toEqual([
      'a',
      '??',
      'b',
      '||',
      'c',
      '&&',
      'd',
      '==',
      'e',
      '!=',
      'f',
      '<=',
      'g',
      '>=',
      'h',
      '',
    ]);
  });

  it('tags every token with its absolute span', () => {
    expect(tokenize('  ab + 12').map((t) => t.span)).toEqual([
      [2, 4],
      [5, 6],
      [7, 9],
      [9, 9],
    ]);
  });

  it('lexes numbers with fractions and exponents', () => {
    const values = ['0', '12', '3.25', '1e3', '2.5E-2', '1e+2'].map((s) => tokenize(s)[0]?.value);
    expect(values).toEqual([0, 12, 3.25, 1000, 0.025, 100]);
  });

  it('does not consume a "." that is not followed by a digit', () => {
    expect(texts('1.x')).toEqual(['1', '.', 'x', '']);
    expect(texts('1e')).toEqual(['1', 'e', '']);
  });

  it('rejects a number that overflows to Infinity', () => {
    expect(() => tokenize('1e999')).toThrow(ExpressionSyntaxError);
  });

  it('decodes string escapes in both quote styles', () => {
    expect(tokenize(String.raw`"a\"b\\c\n\t\rA"`)[0]?.value).toBe('a"b\\c\n\t\rA');
    expect(tokenize(String.raw`'it\'s'`)[0]?.value).toBe("it's");
    expect(tokenize(`"it's"`)[0]?.value).toBe("it's");
  });

  it.each([
    ['unterminated string', '"abc'],
    ['trailing backslash', '"abc\\'],
    ['unknown escape', String.raw`"\q"`],
    ['short unicode escape', String.raw`"\u12"`],
    ['stray character', 'a @ b'],
    ['single ampersand', 'a & b'],
    ['single equals', 'a = b'],
    ['control character', 'a\u0001'],
  ])('rejects %s', (_name, source) => {
    expect(() => tokenize(source)).toThrow(ExpressionSyntaxError);
  });

  it('enforces the token limit', () => {
    const atLimit = Array(MAX_EXPRESSION_TOKENS).fill('1').join(' ');
    expect(() => tokenize(atLimit)).not.toThrow();
    expect(() => tokenize(`${atLimit} 1`)).toThrow(/tokens/);
  });

  it('stops at "}}" outside strings when asked, and ignores it inside strings', () => {
    const tokens = tokenize('{{ a }} rest', 2, true);
    expect(tokens.map((t) => t.type)).toEqual(['ident', 'close']);
    expect(tokens.at(-1)?.span).toEqual([5, 7]);
    expect(tokenize('{{ "}}" }}', 2, true).map((t) => t.type)).toEqual(['string', 'close']);
  });
});
