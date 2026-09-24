import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type ExprBinaryOp,
  type ExprLogicalOp,
  type ExprNode,
  type ExprPathStep,
  stripSpans,
  type TemplateAst,
  type TemplatePart,
} from './ast.ts';
import { parseExpression } from './parser.ts';
import { printExpression, printTemplate } from './printer.ts';
import { parseTemplate } from './template.ts';

const SPAN = [0, 0] as const;
const KEYWORDS = new Set(['true', 'false', 'null']);

const identifier = fc
  .stringMatching(/^[A-Za-z_][A-Za-z0-9_]{0,6}$/)
  .filter((name) => !KEYWORDS.has(name));

// Keys are arbitrary strings, so the printer's `["..."]` escaping is exercised too.
const anyText = fc.oneof(fc.string({ unit: 'binary', maxLength: 8 }), identifier);

const pathStep: fc.Arbitrary<ExprPathStep> = fc.oneof(anyText, fc.nat({ max: 1000 }));

const binaryOps: readonly ExprBinaryOp[] = [
  '+',
  '-',
  '*',
  '/',
  '%',
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
];
const logicalOps: readonly ExprLogicalOp[] = ['&&', '||', '??'];

/**
 * Canonical ASTs: what `parseExpression` can actually produce (no negative literals, no `Path`
 * directly under a `Path` object, every path rooted in an identifier), with zeroed spans.
 */
const { expression } = fc.letrec<{ expression: ExprNode; postfixable: ExprNode }>((tie) => ({
  postfixable: fc.oneof(
    { depthSize: 'small' },
    fc.record({
      kind: fc.constant('Array' as const),
      items: fc.array(tie('expression'), { maxLength: 3 }),
      span: fc.constant(SPAN),
    }),
    fc.record({
      kind: fc.constant('Call' as const),
      name: identifier,
      args: fc.array(tie('expression'), { maxLength: 3 }),
      span: fc.constant(SPAN),
    }),
    fc.record({
      kind: fc.constant('Literal' as const),
      value: fc.oneof(
        fc.string({ unit: 'binary', maxLength: 10 }),
        fc.double({ min: 0, noNaN: true, noDefaultInfinity: true }).map((n) => Math.abs(n)),
        fc.boolean(),
        fc.constant(null),
      ),
      span: fc.constant(SPAN),
    }),
    fc.record({
      kind: fc.constant('Unary' as const),
      op: fc.constantFrom('!' as const, '-' as const),
      operand: tie('expression'),
      span: fc.constant(SPAN),
    }),
    fc.record({
      kind: fc.constant('Binary' as const),
      op: fc.constantFrom(...binaryOps),
      left: tie('expression'),
      right: tie('expression'),
      span: fc.constant(SPAN),
    }),
    fc.record({
      kind: fc.constant('Logical' as const),
      op: fc.constantFrom(...logicalOps),
      left: tie('expression'),
      right: tie('expression'),
      span: fc.constant(SPAN),
    }),
    fc.record({
      kind: fc.constant('Conditional' as const),
      test: tie('expression'),
      consequent: tie('expression'),
      alternate: tie('expression'),
      span: fc.constant(SPAN),
    }),
  ),
  expression: fc.oneof(
    { depthSize: 'small' },
    // A bare identifier path (with steps).
    fc.record({
      kind: fc.constant('Path' as const),
      steps: fc
        .tuple(identifier, fc.array(pathStep, { maxLength: 4 }))
        .map(([root, rest]) => [root, ...rest]),
      span: fc.constant(SPAN),
    }),
    // A path over a non-path expression.
    fc
      .record({
        object: tie('postfixable').filter((node) => node.kind !== 'Path'),
        steps: fc.array(pathStep, { minLength: 1, maxLength: 3 }),
      })
      .map(({ object, steps }) => ({ kind: 'Path' as const, object, steps, span: SPAN })),
    tie('postfixable'),
  ),
}));

const templateParts: fc.Arbitrary<readonly TemplatePart[]> = fc
  .array(
    fc.oneof(
      fc
        .string({
          unit: fc.constantFrom('a', ' ', '\\', '{', '}', 'x'),
          minLength: 1,
          maxLength: 6,
        })
        .map((value): TemplatePart => ({ kind: 'Text', value, span: SPAN })),
      expression.map((expr): TemplatePart => ({ kind: 'Interpolation', expr, span: SPAN })),
    ),
    { maxLength: 5 },
  )
  // The parser merges adjacent text, so a canonical template never has two Text parts in a row.
  .map((parts) => {
    const merged: TemplatePart[] = [];
    for (const part of parts) {
      const last = merged[merged.length - 1];
      if (part.kind === 'Text' && last?.kind === 'Text') {
        merged[merged.length - 1] = { ...last, value: last.value + part.value };
      } else {
        merged.push(part);
      }
    }
    return merged;
  })
  // `{` directly before an interpolation would read as `{{{`, whose first two braces open it —
  // no source text yields that AST, so it is not canonical (see the parseTemplate doc comment).
  .filter((parts) =>
    parts.every((part, i) => {
      const next = parts[i + 1];
      return !(part.kind === 'Text' && part.value.endsWith('{') && next?.kind === 'Interpolation');
    }),
  );

describe('round trip', () => {
  it('parse(print(ast)) equals ast for every canonical expression AST', () => {
    fc.assert(
      fc.property(expression, (ast) => {
        const printed = printExpression(ast);
        const parsed = parseExpression(printed);
        expect(parsed.ok, printed).toBe(true);
        if (parsed.ok) expect(stripSpans(parsed.value)).toEqual(ast);
      }),
      { numRuns: 1000 },
    );
  });

  it('print is a fixed point: print(parse(print(ast))) === print(ast)', () => {
    fc.assert(
      fc.property(expression, (ast) => {
        const printed = printExpression(ast);
        const parsed = parseExpression(printed);
        if (parsed.ok) expect(printExpression(parsed.value)).toBe(printed);
      }),
      { numRuns: 500 },
    );
  });

  it('parseTemplate(printTemplate(ast)) equals ast for every canonical template AST', () => {
    fc.assert(
      fc.property(templateParts, (parts) => {
        const ast: TemplateAst = { kind: 'Template', parts, span: SPAN };
        const printed = printTemplate(ast);
        const parsed = parseTemplate(printed);
        expect(parsed.ok, printed).toBe(true);
        if (parsed.ok) expect(stripSpans(parsed.value)).toEqual(ast);
      }),
      { numRuns: 1000 },
    );
  });
});

const TOKEN_SOUP = [
  '(',
  ')',
  '[',
  ']',
  '{{',
  '}}',
  '{',
  '}',
  ',',
  '.',
  '?',
  ':',
  '??',
  '||',
  '&&',
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  '+',
  '-',
  '*',
  '/',
  '%',
  '!',
  '"',
  "'",
  '\\',
  ' ',
  'a',
  'b1',
  '_',
  '0',
  '12',
  '3.5',
  '1e9',
  'true',
  'null',
  'f(',
  '\n',
  '\u0000',
  '\ud800',
  'é',
];

const VALID_SOURCES = [
  'a + b * c',
  'post.images[0].alt ?? "none"',
  'plural(count, "one", "few")',
  'truncate(title, 10, "…") + (published ? " ✓" : "")',
  '(a ? b : c).d[1]',
  '!a && -b < 3 || [1, 2, f(x)][0] == null',
];
const VALID_TEMPLATES = [
  'Hello {{ user.name }}!',
  String.raw`\{{ not }} {{ a ?? "}}" }}`,
  '{{ a }}{{ b }} tail',
];

/** Inserts, deletes and overwrites a few characters of a valid source. */
const mutated = (sources: readonly string[]) =>
  fc
    .tuple(
      fc.constantFrom(...sources),
      fc.array(
        fc.tuple(
          fc.nat(60),
          fc.constantFrom('insert', 'delete', 'replace'),
          fc.constantFrom(...TOKEN_SOUP),
        ),
        { minLength: 1, maxLength: 4 },
      ),
    )
    .map(([source, edits]) => {
      let out = source;
      for (const [at, op, piece] of edits) {
        const i = at % (out.length + 1);
        if (op === 'insert') out = out.slice(0, i) + piece + out.slice(i);
        else if (op === 'delete') out = out.slice(0, i) + out.slice(i + 1);
        else out = out.slice(0, i) + piece + out.slice(i + 1);
      }
      return out;
    });

const hostileInputs = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 300 }),
  fc.string({ unit: 'grapheme', maxLength: 100 }),
  fc.array(fc.constantFrom(...TOKEN_SOUP), { maxLength: 80 }).map((tokens) => tokens.join('')),
  fc.array(fc.constantFrom(...TOKEN_SOUP), { maxLength: 80 }).map((tokens) => tokens.join(' ')),
  mutated(VALID_SOURCES),
  mutated(VALID_TEMPLATES),
);

describe('fuzzing', () => {
  it('parseExpression and parseTemplate never throw on arbitrary input', () => {
    fc.assert(
      fc.property(hostileInputs, (source) => {
        for (const result of [parseExpression(source), parseTemplate(source)]) {
          expect(typeof result.ok).toBe('boolean');
          if (!result.ok) {
            expect(result.error.severity).toBe('error');
            expect(result.error.code).toMatch(/^expr\./);
            expect(result.error.details?.start).toBeTypeOf('number');
          }
        }
      }),
      { numRuns: 5000 },
    );
  });

  it('whatever parses also prints to source that parses back to the same AST', () => {
    fc.assert(
      fc.property(hostileInputs, (source) => {
        const first = parseExpression(source);
        if (!first.ok) return;
        const printed = printExpression(first.value);
        const second = parseExpression(printed);
        expect(second.ok, printed).toBe(true);
        if (second.ok) expect(stripSpans(second.value)).toEqual(stripSpans(first.value));

        const template = parseTemplate(source);
        if (!template.ok) return;
        const reparsed = parseTemplate(printTemplate(template.value));
        expect(reparsed.ok).toBe(true);
        if (reparsed.ok) expect(stripSpans(reparsed.value)).toEqual(stripSpans(template.value));
      }),
      { numRuns: 3000 },
    );
  });

  it.each([
    ['unclosed parens', '('.repeat(1999)],
    ['unclosed brackets', '['.repeat(1999)],
    ['unary chain', `${'-'.repeat(1999)}1`],
    ['long path', `a${'.b'.repeat(999)}`],
    ['nested calls', `${'f('.repeat(999)}1`],
    ['nested ternaries', `${'a ? '.repeat(400)}1`],
    ['backslashes', '\\'.repeat(2000)],
    ['quote soup', '"\\'.repeat(1000)],
    ['open templates', '{{'.repeat(1000)],
    ['open template exprs', '{{ '.repeat(600)],
    ['closed empty templates', '{{}}'.repeat(500)],
    ['many interpolations', '{{ a }}'.repeat(280)],
    ['escapes', String.raw`\{{`.repeat(600)],
    ['long token run', '1 '.repeat(999)],
    ['whitespace', ' '.repeat(2000)],
  ])('finishes quickly on %s', (_name, source) => {
    const start = performance.now();
    expect(() => {
      parseExpression(source);
      parseTemplate(source);
    }).not.toThrow();
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe('performance', () => {
  it('parses a typical expression in under 0.1ms', () => {
    const source =
      'formatCurrency(post.price * 1.23, "PLN") + (post.stock > 0 ? " · in stock" : "")';
    for (let i = 0; i < 500; i += 1) parseExpression(source);

    const runs = 2000;
    const start = performance.now();
    for (let i = 0; i < runs; i += 1) parseExpression(source);
    const perParse = (performance.now() - start) / runs;

    expect(perParse).toBeLessThan(0.1);
  });
});
