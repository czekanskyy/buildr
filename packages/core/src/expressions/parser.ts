import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import {
  type ExprBinaryOp,
  type ExprLogicalOp,
  type ExprNode,
  type ExprPathNode,
  type ExprPathStep,
  type ExprSpan,
  MAX_EXPRESSION_DEPTH,
  MAX_EXPRESSION_LENGTH,
} from './ast.ts';
import { ExpressionSyntaxError, type ExprToken, tokenize } from './lexer.ts';

/** Binding powers, lowest to highest (see the grammar in docs/expressions.md). */
const TERNARY_BP = 1;
const BINARY_BP: Readonly<Record<string, number>> = {
  '??': 2,
  '||': 3,
  '&&': 4,
  '==': 5,
  '!=': 5,
  '<': 6,
  '<=': 6,
  '>': 6,
  '>=': 6,
  '+': 7,
  '-': 7,
  '*': 8,
  '/': 8,
  '%': 8,
};

const LOGICAL_OPS = new Set(['??', '||', '&&']);
const KEYWORDS: Readonly<Record<string, boolean | null>> = { true: true, false: false, null: null };

function isKeyword(name: string): boolean {
  return Object.hasOwn(KEYWORDS, name);
}

function describeToken(token: ExprToken): string {
  if (token.type === 'end') return 'end of input';
  return `"${token.text}"`;
}

class Parser {
  private pos = 0;
  private readonly depths = new WeakMap<ExprNode, number>();

  constructor(private readonly tokens: readonly ExprToken[]) {}

  parseAll(): ExprNode {
    const node = this.parseExpr(0);
    const token = this.peek();
    if (token.type !== 'end' && token.type !== 'close') {
      throw new ExpressionSyntaxError(
        'expr.syntax',
        `Unexpected ${describeToken(token)}.`,
        token.span,
      );
    }
    return node;
  }

  private peek(): ExprToken {
    return this.tokens[this.pos] as ExprToken;
  }

  private next(): ExprToken {
    const token = this.peek();
    if (token.type !== 'end' && token.type !== 'close') this.pos += 1;
    return token;
  }

  private isPunct(text: string): boolean {
    const token = this.peek();
    return token.type === 'punct' && token.text === text;
  }

  private expectPunct(text: string): ExprToken {
    const token = this.peek();
    if (token.type !== 'punct' || token.text !== text) {
      throw new ExpressionSyntaxError(
        'expr.syntax',
        `Expected "${text}", found ${describeToken(token)}.`,
        token.span,
      );
    }
    return this.next();
  }

  /** Registers `node`'s depth (1 + its deepest child) and enforces `MAX_EXPRESSION_DEPTH`. */
  private track<T extends ExprNode>(node: T, ...children: readonly ExprNode[]): T {
    let deepest = 0;
    for (const child of children) deepest = Math.max(deepest, this.depths.get(child) ?? 1);
    const depth = deepest + 1;
    if (depth > MAX_EXPRESSION_DEPTH) {
      throw new ExpressionSyntaxError(
        'expr.limit',
        `Expression is nested more than ${MAX_EXPRESSION_DEPTH} levels deep.`,
        node.span,
        MAX_EXPRESSION_DEPTH,
      );
    }
    this.depths.set(node, depth);
    return node;
  }

  private parseExpr(minBp: number): ExprNode {
    let left = this.parseUnary();

    for (;;) {
      const token = this.peek();
      if (token.type !== 'punct') break;

      if (token.text === '?') {
        if (TERNARY_BP < minBp) break;
        this.next();
        const consequent = this.parseExpr(0);
        this.expectPunct(':');
        const alternate = this.parseExpr(0);
        left = this.track(
          {
            kind: 'Conditional',
            test: left,
            consequent,
            alternate,
            span: [left.span[0], alternate.span[1]],
          },
          left,
          consequent,
          alternate,
        );
        continue;
      }

      const bp = Object.hasOwn(BINARY_BP, token.text) ? (BINARY_BP[token.text] as number) : 0;
      if (bp === 0 || bp < minBp) break;
      this.next();
      const right = this.parseExpr(bp + 1);
      const span: ExprSpan = [left.span[0], right.span[1]];
      left = LOGICAL_OPS.has(token.text)
        ? this.track(
            { kind: 'Logical', op: token.text as ExprLogicalOp, left, right, span },
            left,
            right,
          )
        : this.track(
            { kind: 'Binary', op: token.text as ExprBinaryOp, left, right, span },
            left,
            right,
          );
    }

    return left;
  }

  private parseUnary(): ExprNode {
    const token = this.peek();
    if (token.type === 'punct' && (token.text === '!' || token.text === '-')) {
      this.next();
      const operand = this.parseUnary();
      return this.track(
        { kind: 'Unary', op: token.text, operand, span: [token.span[0], operand.span[1]] },
        operand,
      );
    }
    return this.parsePostfix();
  }

  private parsePostfix(): ExprNode {
    let node = this.parsePrimary();

    for (;;) {
      let step: ExprPathStep;
      let end: number;

      if (this.isPunct('.')) {
        this.next();
        const key = this.next();
        if (key.type !== 'ident') {
          throw new ExpressionSyntaxError(
            'expr.syntax',
            `Expected a property name after ".", found ${describeToken(key)}.`,
            key.span,
          );
        }
        step = key.text;
        end = key.span[1];
      } else if (this.isPunct('[')) {
        this.next();
        const key = this.next();
        if (key.type === 'string') {
          step = key.value as string;
        } else if (key.type === 'number') {
          const index = key.value as number;
          if (!Number.isSafeInteger(index)) {
            throw new ExpressionSyntaxError(
              'expr.syntax',
              'An index must be a non-negative integer.',
              key.span,
            );
          }
          step = index;
        } else {
          throw new ExpressionSyntaxError(
            'expr.syntax',
            `Expected a number or a string inside "[]", found ${describeToken(key)}.`,
            key.span,
          );
        }
        end = this.expectPunct(']').span[1];
      } else {
        return node;
      }

      node = this.extendPath(node, step, end);
    }
  }

  /** Applies one step to `base`, folding it into `base` when that is already a path. */
  private extendPath(base: ExprNode, step: ExprPathStep, end: number): ExprPathNode {
    const span: ExprSpan = [base.span[0], end];
    if (base.kind === 'Path') {
      const steps = [...base.steps, step];
      return base.object === undefined
        ? this.track({ kind: 'Path', steps, span })
        : this.track({ kind: 'Path', object: base.object, steps, span }, base.object);
    }
    return this.track({ kind: 'Path', object: base, steps: [step], span }, base);
  }

  private parsePrimary(): ExprNode {
    const token = this.next();

    switch (token.type) {
      case 'number':
        return this.track({ kind: 'Literal', value: token.value as number, span: token.span });
      case 'string':
        return this.track({ kind: 'Literal', value: token.value as string, span: token.span });
      case 'ident':
        return this.parseIdentifier(token);
      case 'punct':
        if (token.text === '(') {
          const inner = this.parseExpr(0);
          const close = this.expectPunct(')');
          const wrapped = { ...inner, span: [token.span[0], close.span[1]] } as ExprNode;
          this.depths.set(wrapped, this.depths.get(inner) ?? 1);
          return wrapped;
        }
        if (token.text === '[') {
          const items = this.parseList(']');
          const close = this.tokens[this.pos - 1] as ExprToken;
          return this.track(
            { kind: 'Array', items, span: [token.span[0], close.span[1]] },
            ...items,
          );
        }
        break;
      default:
        break;
    }

    throw new ExpressionSyntaxError(
      'expr.syntax',
      `Expected an expression, found ${describeToken(token)}.`,
      token.span,
    );
  }

  private parseIdentifier(token: ExprToken): ExprNode {
    if (isKeyword(token.text)) {
      if (this.isPunct('(')) {
        throw new ExpressionSyntaxError(
          'expr.syntax',
          `"${token.text}" is not a function.`,
          token.span,
        );
      }
      return this.track({
        kind: 'Literal',
        value: KEYWORDS[token.text] as boolean | null,
        span: token.span,
      });
    }

    if (this.isPunct('(')) {
      this.next();
      const args = this.parseList(')');
      const close = this.tokens[this.pos - 1] as ExprToken;
      return this.track(
        { kind: 'Call', name: token.text, args, span: [token.span[0], close.span[1]] },
        ...args,
      );
    }

    return this.track({ kind: 'Path', steps: [token.text], span: token.span });
  }

  /** Parses `expr (',' expr)* closer` after the opening bracket; an empty list is allowed. */
  private parseList(closer: ']' | ')'): ExprNode[] {
    const items: ExprNode[] = [];
    if (this.isPunct(closer)) {
      this.next();
      return items;
    }
    for (;;) {
      items.push(this.parseExpr(0));
      if (this.isPunct(',')) {
        this.next();
        continue;
      }
      this.expectPunct(closer);
      return items;
    }
  }
}

/** Parses a token list ending in `end` or `close` into one expression; throws on any violation. */
export function parseTokens(tokens: readonly ExprToken[]): ExprNode {
  return new Parser(tokens).parseAll();
}

/** Converts a syntax/limit error into a position-tagged `Diagnostic`. */
export function toDiagnostic(error: ExpressionSyntaxError): Diagnostic {
  const details: Record<string, number> =
    error.limit === undefined
      ? { start: error.span[0], end: error.span[1] }
      : { start: error.span[0], end: error.span[1], limit: error.limit };
  return {
    code: error.code,
    message: `${error.message} (at position ${error.span[0]})`,
    severity: 'error',
    details,
  };
}

/**
 * Parses expression source (docs/expressions.md#grammar) into an AST. Never throws: a syntax error
 * or a breached limit (source length, token count, AST depth) is a single position-tagged
 * `Diagnostic` in `details.start`/`details.end`.
 */
export function parseExpression(source: string): Result<ExprNode, Diagnostic> {
  try {
    if (source.length > MAX_EXPRESSION_LENGTH) {
      throw new ExpressionSyntaxError(
        'expr.limit',
        `Expression is longer than ${MAX_EXPRESSION_LENGTH} characters.`,
        [MAX_EXPRESSION_LENGTH, source.length],
        MAX_EXPRESSION_LENGTH,
      );
    }
    return ok(parseTokens(tokenize(source)));
  } catch (error) {
    if (error instanceof ExpressionSyntaxError) return err(toDiagnostic(error));
    throw error;
  }
}
