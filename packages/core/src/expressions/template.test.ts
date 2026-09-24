import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../result/diagnostic.ts';
import { MAX_EXPRESSION_LENGTH, stripSpans, type TemplateAst } from './ast.ts';
import { printTemplate } from './printer.ts';
import { parseTemplate } from './template.ts';

function parse(source: string): TemplateAst {
  const result = parseTemplate(source);
  if (!result.ok) throw new Error(`${source}: ${result.error.message}`);
  return result.value;
}

function failure(source: string): Diagnostic {
  const result = parseTemplate(source);
  if (result.ok) throw new Error(`expected "${source}" to fail`);
  return result.error;
}

/** Text parts as strings and interpolations as `{expr-kind}`, to keep assertions short. */
function outline(source: string): string[] {
  return parse(source).parts.map((p) => (p.kind === 'Text' ? p.value : `{${p.expr.kind}}`));
}

describe('parseTemplate', () => {
  it('parses plain text, an interpolation, and a mix', () => {
    expect(outline('')).toEqual([]);
    expect(outline('just text')).toEqual(['just text']);
    expect(outline('{{ a }}')).toEqual(['{Path}']);
    expect(outline('Hello {{ user.name }}, you have {{ count }} items')).toEqual([
      'Hello ',
      '{Path}',
      ', you have ',
      '{Path}',
      ' items',
    ]);
    expect(outline('{{ a }}{{ b }}')).toEqual(['{Path}', '{Path}']);
  });

  it('parses full expressions inside interpolations', () => {
    expect(outline('{{ a > 1 ? "many" : "few" }} / {{ upper(t) }}')).toEqual([
      '{Conditional}',
      ' / ',
      '{Call}',
    ]);
  });

  it('tags parts with offsets into the whole template', () => {
    const { parts, span } = parse('Hi {{ a + 1 }}!');
    expect(span).toEqual([0, 15]);
    expect(parts.map((p) => p.span)).toEqual([
      [0, 3],
      [3, 14],
      [14, 15],
    ]);
    const interpolation = parts[1];
    if (interpolation?.kind !== 'Interpolation') throw new Error('expected an interpolation');
    expect(interpolation.expr.span).toEqual([6, 11]);
  });

  it('does not end an interpolation at a "}}" inside a string', () => {
    expect(outline('{{ "a}}b" }}')).toEqual(['{Literal}']);
  });

  it('treats a stray "}}", a lone "{", and a lone "}" as text', () => {
    expect(outline('a }} b { c } d')).toEqual(['a }} b { c } d']);
  });

  describe('escaping', () => {
    it.each([
      [String.raw`\{{ a }}`, ['{{ a }}']],
      [String.raw`x \{{ y }} z {{ w }}`, ['x {{ y }} z ', '{Path}']],
      [String.raw`\\{{ a }}`, ['\\', '{Path}']],
      [String.raw`\\\{{ a }}`, ['\\{{ a }}']],
      [String.raw`\\\\{{ a }}`, ['\\\\', '{Path}']],
      [String.raw`a\b`, ['a\\b']],
      [String.raw`a\{b`, ['a\\{b']],
      [String.raw`trailing\\`, ['trailing\\\\']],
    ])('%s', (source, expected) => {
      expect(outline(source)).toEqual(expected);
    });
  });

  describe('errors', () => {
    it.each([
      ['{{ a', 'Unterminated "{{"', 0],
      ['x {{', 'Unterminated "{{"', 2],
      ['{{ }}', 'Empty "{{ }}"', 0],
      ['ok {{}}', 'Empty "{{ }}"', 3],
      ['{{ a + }}', 'Expected an expression, found "}}"', 7],
      ['{{ a b }}', 'Unexpected "b"', 5],
      ['hello {{ 1 + }} world', 'Expected an expression, found "}}"', 13],
      ['{{ "abc }}', 'Unterminated string', 3],
      ['{{ a }} {{ @ }}', 'Unexpected character "@"', 11],
    ])('%j → %s', (source, message, position) => {
      const error = failure(source);
      expect(error).toMatchObject({ code: 'expr.syntax', severity: 'error' });
      expect(error.message).toContain(message);
      expect(error.details?.start).toBe(position);
    });

    it('rejects a template over the length limit', () => {
      expect(parseTemplate('a'.repeat(MAX_EXPRESSION_LENGTH)).ok).toBe(true);
      expect(failure('a'.repeat(MAX_EXPRESSION_LENGTH + 1))).toMatchObject({
        code: 'expr.limit',
      });
    });

    it('applies the per-expression token limit inside an interpolation', () => {
      const tooMany = Array(300).fill('1').join('+');
      expect(failure(`{{ ${tooMany} }}`).code).toBe('expr.limit');
    });
  });
});

describe('printTemplate', () => {
  it.each([
    ['plain', 'plain'],
    ['Hello {{user.name}}!', 'Hello {{ user.name }}!'],
    ['{{a+b}}{{  c  }}', '{{ a + b }}{{ c }}'],
    [String.raw`\{{ a }}`, String.raw`\{{ a }}`],
    [String.raw`\\{{ a }}`, String.raw`\\{{ a }}`],
    [String.raw`\\\{{ a }}`, String.raw`\\\{{ a }}`],
    [String.raw`a\b {{ x }}`, String.raw`a\b {{ x }}`],
  ])('normalizes %j', (source, expected) => {
    expect(printTemplate(parse(source))).toBe(expected);
  });

  it('round-trips a template whose text ends in a backslash before an interpolation', () => {
    const template = parse(String.raw`a\\{{ x }}`);
    expect(template.parts[0]).toMatchObject({ kind: 'Text', value: 'a\\' });
    const printed = printTemplate(template);
    expect(stripSpans(parse(printed))).toEqual(stripSpans(template));
  });
});
