import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../result/diagnostic.ts';
import {
  type ExprNode,
  MAX_EXPRESSION_DEPTH,
  MAX_EXPRESSION_LENGTH,
  MAX_EXPRESSION_TOKENS,
  stripSpans,
} from './ast.ts';
import { parseExpression } from './parser.ts';
import { printExpression } from './printer.ts';

function parse(source: string): ExprNode {
  const result = parseExpression(source);
  if (!result.ok) throw new Error(`${source}: ${result.error.message}`);
  return result.value;
}

function failure(source: string): Diagnostic {
  const result = parseExpression(source);
  if (result.ok) throw new Error(`expected "${source}" to fail`);
  return result.error;
}

/** Fully parenthesized rendering — makes the shape of the tree visible in assertions. */
function shape(node: ExprNode): string {
  switch (node.kind) {
    case 'Literal':
      return JSON.stringify(node.value);
    case 'Path':
      return (node.object ? `<${shape(node.object)}>` : '') + node.steps.join('.');
    case 'Array':
      return `[${node.items.map(shape).join(',')}]`;
    case 'Unary':
      return `(${node.op}${shape(node.operand)})`;
    case 'Binary':
    case 'Logical':
      return `(${shape(node.left)} ${node.op} ${shape(node.right)})`;
    case 'Conditional':
      return `(${shape(node.test)} ? ${shape(node.consequent)} : ${shape(node.alternate)})`;
    case 'Call':
      return `${node.name}(${node.args.map(shape).join(',')})`;
  }
}

describe('parseExpression: primaries', () => {
  it('parses literals', () => {
    expect(parse('42')).toMatchObject({ kind: 'Literal', value: 42 });
    expect(parse('"hi"')).toMatchObject({ kind: 'Literal', value: 'hi' });
    expect(parse('true')).toMatchObject({ kind: 'Literal', value: true });
    expect(parse('false')).toMatchObject({ kind: 'Literal', value: false });
    expect(parse('null')).toMatchObject({ kind: 'Literal', value: null });
  });

  it('parses paths with keys, indices and string keys', () => {
    expect(parse('post.author.name')).toMatchObject({
      kind: 'Path',
      steps: ['post', 'author', 'name'],
    });
    expect(parse('post.images[0].alt')).toMatchObject({
      kind: 'Path',
      steps: ['post', 'images', 0, 'alt'],
    });
    expect(parse('post["a b"]')).toMatchObject({ kind: 'Path', steps: ['post', 'a b'] });
    expect(stripSpans(parse("post['title']"))).toEqual(stripSpans(parse('post.title')));
  });

  it('parses calls and array literals', () => {
    expect(shape(parse('f()'))).toBe('f()');
    expect(shape(parse('truncate(title, 10, "…")'))).toBe('truncate(title,10,"…")');
    expect(shape(parse('[]'))).toBe('[]');
    expect(shape(parse('[1, [2], a + 1]'))).toBe('[1,[2],(a + 1)]');
  });

  it('applies postfix steps to any primary and folds them into paths', () => {
    expect(shape(parse('(a ? b : c).d'))).toBe('<(a ? b : c)>d');
    expect(shape(parse('[1, 2][0]'))).toBe('<[1,2]>0');
    expect(shape(parse('first(xs).title'))).toBe('<first(xs)>title');
    expect(shape(parse('(a.b).c'))).toBe('a.b.c');
    expect(shape(parse('f(x).a.b[1]'))).toBe('<f(x)>a.b.1');
  });

  it('does not treat keywords as functions', () => {
    expect(failure('null(1)').code).toBe('expr.syntax');
  });
});

describe('parseExpression: precedence and associativity', () => {
  it.each([
    ['a + b * c', '(a + (b * c))'],
    ['a * b + c', '((a * b) + c)'],
    ['a - b - c', '((a - b) - c)'],
    ['a / b * c % d', '(((a / b) * c) % d)'],
    ['a + b < c', '((a + b) < c)'],
    ['a < b == c > d', '((a < b) == (c > d))'],
    ['a < b < c', '((a < b) < c)'],
    ['a == b != c', '((a == b) != c)'],
    ['a == b && c == d', '((a == b) && (c == d))'],
    ['a && b || c && d', '((a && b) || (c && d))'],
    ['a || b ?? c || d', '((a || b) ?? (c || d))'],
    ['a ?? b ?? c', '((a ?? b) ?? c)'],
    ['a ?? b || c', '(a ?? (b || c))'],
    ['!a && b', '((!a) && b)'],
    ['-a * b', '((-a) * b)'],
    ['- -a', '(-(-a))'],
    ['!!a', '(!(!a))'],
    ['-a.b', '(-a.b)'],
    ['a - -1', '(a - (-1))'],
    ['(a + b) * c', '((a + b) * c)'],
    ['a ? b : c', '(a ? b : c)'],
    ['a || b ? c : d', '((a || b) ? c : d)'],
    ['a ?? b ? c : d', '((a ?? b) ? c : d)'],
    ['a ? b : c ? d : e', '(a ? b : (c ? d : e))'],
    ['a ? b ? c : d : e', '(a ? (b ? c : d) : e)'],
    ['a ? b : c + 1', '(a ? b : (c + 1))'],
    ['x + a ? b : c', '((x + a) ? b : c)'],
    ['(a ? b : c) ? d : e', '((a ? b : c) ? d : e)'],
  ])('%s', (source, expected) => {
    expect(shape(parse(source))).toBe(expected);
  });

  it('classifies operators into Binary and Logical nodes', () => {
    expect(parse('a + b').kind).toBe('Binary');
    expect(parse('a == b').kind).toBe('Binary');
    expect(parse('a && b').kind).toBe('Logical');
    expect(parse('a || b').kind).toBe('Logical');
    expect(parse('a ?? b').kind).toBe('Logical');
  });
});

describe('parseExpression: spans', () => {
  it('tags each node with its source range', () => {
    const node = parse('  a + foo(1, b)');
    expect(node.span).toEqual([2, 15]);
    if (node.kind !== 'Binary') throw new Error('expected Binary');
    expect(node.left.span).toEqual([2, 3]);
    expect(node.right.span).toEqual([6, 15]);
  });

  it('includes parentheses in the span of a parenthesized expression', () => {
    const node = parse('(a) + b');
    expect(node.span).toEqual([0, 7]);
    if (node.kind !== 'Binary') throw new Error('expected Binary');
    expect(node.left.span).toEqual([0, 3]);
  });

  it('spans a whole path, including bracket steps', () => {
    expect(parse('  a.b[0]["c"] ').span).toEqual([2, 13]);
  });
});

describe('parseExpression: errors', () => {
  it.each([
    ['', 'Expected an expression, found end of input', 0],
    ['1 +', 'Expected an expression, found end of input', 3],
    ['(1', 'Expected ")", found end of input', 2],
    ['1)', 'Unexpected ")"', 1],
    ['f(1,)', 'Expected an expression, found ")"', 4],
    ['f(1 2)', 'Expected ")", found "2"', 4],
    ['[1,,2]', 'Expected an expression, found ","', 3],
    ['a ? b', 'Expected ":", found end of input', 5],
    ['a.', 'Expected a property name after ".", found end of input', 2],
    ['a.1', 'Expected a property name after ".", found "1"', 2],
    ['a[', 'Expected a number or a string inside "[]", found end of input', 2],
    ['a[b]', 'Expected a number or a string inside "[]", found "b"', 2],
    ['a[1', 'Expected "]", found end of input', 3],
    ['a[1.5]', 'An index must be a non-negative integer', 2],
    ['a[1e300]', 'An index must be a non-negative integer', 2],
    ['1 2', 'Unexpected "2"', 2],
    ['a b', 'Unexpected "b"', 2],
    ['a @ b', 'Unexpected character "@"', 2],
    ['* 2', 'Expected an expression, found "*"', 0],
    ['a ? : b', 'Expected an expression, found ":"', 4],
  ])('%j → %s', (source, message, position) => {
    const error = failure(source);
    expect(error).toMatchObject({ code: 'expr.syntax', severity: 'error' });
    expect(error.message).toContain(message);
    expect(error.message).toContain(`at position ${position}`);
    expect(error.details?.start).toBe(position);
  });

  it('reports an end at or after the start', () => {
    for (const source of ['', '((', '"', '\\', '{{', '\u0000', 'a.b.', '1 ? 2']) {
      const error = failure(source);
      expect(error.details?.end).toBeGreaterThanOrEqual(error.details?.start as number);
    }
  });
});

describe('parseExpression: limits', () => {
  it('accepts a source of exactly the max length and rejects one char more', () => {
    const padded = `1${' '.repeat(MAX_EXPRESSION_LENGTH - 1)}`;
    expect(padded.length).toBe(MAX_EXPRESSION_LENGTH);
    expect(parseExpression(padded).ok).toBe(true);
    expect(failure(`${padded} `)).toMatchObject({
      code: 'expr.limit',
      details: { limit: MAX_EXPRESSION_LENGTH },
    });
  });

  it('accepts the max token count and rejects one more', () => {
    const list = (items: number) => `[${Array(items).fill('1').join(',')}]`;
    // "[" + n items + (n - 1) commas + "]" tokens.
    const fits = Math.floor(MAX_EXPRESSION_TOKENS / 2) - 1;
    expect(parseExpression(list(fits)).ok).toBe(true);
    expect(failure(list(fits + 1))).toMatchObject({
      code: 'expr.limit',
      details: { limit: MAX_EXPRESSION_TOKENS },
    });
  });

  it('accepts an AST of the max depth and rejects one level deeper', () => {
    const nested = (levels: number) => `${'-'.repeat(levels)}1`;
    expect(parseExpression(nested(MAX_EXPRESSION_DEPTH - 1)).ok).toBe(true);
    expect(failure(nested(MAX_EXPRESSION_DEPTH))).toMatchObject({
      code: 'expr.limit',
      details: { limit: MAX_EXPRESSION_DEPTH },
    });
  });

  it('counts a left-leaning operator chain towards the depth limit', () => {
    const chain = (terms: number) => Array(terms).fill('1').join('+');
    expect(parseExpression(chain(MAX_EXPRESSION_DEPTH)).ok).toBe(true);
    expect(failure(chain(MAX_EXPRESSION_DEPTH + 1)).code).toBe('expr.limit');
  });

  it('does not count parentheses as depth, and survives deeply nested ones', () => {
    expect(parseExpression(`${'('.repeat(200)}1${')'.repeat(200)}`).ok).toBe(true);
  });

  it('does not count path steps as depth', () => {
    expect(parseExpression(`a${'.b'.repeat(100)}`).ok).toBe(true);
  });
});

describe('printExpression on parsed source', () => {
  it.each([
    'a+b*c',
    '(a+b)*c',
    'a-(b-c)',
    'a - b - c',
    'a?b:c?d:e',
    '(a?b:c)?d:e',
    '!(a&&b)',
    '-(a+b)',
    '- -a',
    '(x ?? y).z',
    '[1,2][0]',
    'f(a,[b],c?d:e)',
    "a['b c'][0].d",
    '"quote \\" and \\\\ and \\n"',
    '1e21+0.5',
  ])('print(parse(%j)) is stable', (source) => {
    const ast = parse(source);
    const printed = printExpression(ast);
    expect(stripSpans(parse(printed))).toEqual(stripSpans(ast));
    expect(printExpression(parse(printed))).toBe(printed);
  });

  it('prints normalized source with minimal parentheses', () => {
    expect(printExpression(parse('(a)+((b*c))'))).toBe('a + b * c');
    expect(printExpression(parse('(a+b)*c'))).toBe('(a + b) * c');
    expect(printExpression(parse('a-(b-c)'))).toBe('a - (b - c)');
    expect(printExpression(parse("a['b']['c d'][1]"))).toBe('a.b["c d"][1]');
    expect(printExpression(parse("f( 'x' ,[1,2] )"))).toBe('f("x", [1, 2])');
    expect(printExpression(parse('(a?b:c)?d:e'))).toBe('(a ? b : c) ? d : e');
    expect(printExpression(parse('a?b:c?d:e'))).toBe('a ? b : c ? d : e');
  });
});
