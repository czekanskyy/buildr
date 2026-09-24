import type { DataContext } from '../data/context.ts';
import { getPath, parsePath } from '../data/path.ts';
import type { JsonValue } from '../json/json-value.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import type { ExprNode, ExprSpan, TemplateAst } from './ast.ts';
import { acceptsArity, paramAt, stdlib } from './stdlib/index.ts';
import { jsonEquals } from './stdlib/list.ts';
import { isTruthy } from './stdlib/logic.ts';
import {
  MAX_LIST_ELEMENTS,
  MAX_RESULT_TEXT,
  StdlibArgError,
  type StdlibEnv,
  stringify,
  typeOf,
} from './stdlib/types.ts';

/** Max evaluation steps (one per node visited, plus one per element of a list/string a function walks) — docs/expressions.md#limits. */
export const MAX_EVALUATION_STEPS = 10_000;
/**
 * Max nesting the evaluator will recurse into. A parsed AST never exceeds `MAX_EXPRESSION_DEPTH`
 * (32); the larger bound only exists so a hand-built or deserialized AST cannot overflow the stack.
 */
const MAX_EVALUATION_DEPTH = 64;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface EvaluateOptions {
  /** Lowers the step budget (never raises it above `MAX_EVALUATION_STEPS`). */
  readonly maxSteps?: number;
  /**
   * Receives the warnings of an evaluation that still produced a value — division by zero, a type
   * mismatch, a path that cannot be read. Each of those evaluates to `null`.
   */
  readonly diagnostics?: Diagnostic[];
}

/** An unrecoverable problem: the result is a `Diagnostic` with severity `error`, not a value. */
class EvaluationFailure extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
  }
}

function spanDetails(span: ExprSpan): Record<string, number> {
  return { start: span[0], end: span[1] };
}

function arityText(fn: Parameters<typeof acceptsArity>[0]): string {
  const min = fn.params.filter((p) => p.optional !== true).length;
  if (fn.rest !== undefined) return `at least ${min}`;
  return min === fn.params.length ? String(min) : `${min} to ${fn.params.length}`;
}

class Evaluation {
  private steps = 0;

  constructor(
    private readonly ctx: DataContext,
    private readonly maxSteps: number,
    private readonly sink: Diagnostic[] | undefined,
  ) {}

  fail(code: string, message: string, span: ExprSpan): never {
    throw new EvaluationFailure({ code, message, severity: 'error', details: spanDetails(span) });
  }

  warn(code: string, message: string, span: ExprSpan): null {
    this.sink?.push({ code, message, severity: 'warning', details: spanDetails(span) });
    return null;
  }

  charge(n: number, span: ExprSpan): void {
    this.steps += n;
    if (this.steps > this.maxSteps) {
      this.fail('expr.limit', `Evaluation exceeded ${this.maxSteps} steps.`, span);
    }
  }

  visit(node: ExprNode, depth: number): JsonValue {
    if (depth > MAX_EVALUATION_DEPTH) {
      this.fail(
        'expr.limit',
        `Expression is nested deeper than ${MAX_EVALUATION_DEPTH}.`,
        node.span,
      );
    }
    this.charge(1, node.span);
    const value = this.dispatch(node, depth);
    if (typeof value === 'string' && value.length > MAX_RESULT_TEXT) {
      this.fail('expr.limit', `Text is longer than ${MAX_RESULT_TEXT} characters.`, node.span);
    }
    return value;
  }

  /** Evaluates one template interpolation to the text it contributes (`null` is empty). */
  interpolate(node: ExprNode): string {
    const text = stringify(this.visit(node, 0));
    if (text === undefined) {
      this.warn('expr.type-mismatch', 'A list or an object cannot be shown as text.', node.span);
      return '';
    }
    return text;
  }

  private dispatch(node: ExprNode, depth: number): JsonValue {
    switch (node.kind) {
      case 'Literal':
        return node.value;
      case 'Path':
        return this.path(node, depth);
      case 'Array': {
        if (node.items.length > MAX_LIST_ELEMENTS) {
          this.fail('expr.limit', `Lists are limited to ${MAX_LIST_ELEMENTS} elements.`, node.span);
        }
        return node.items.map((item) => this.visit(item, depth + 1));
      }
      case 'Unary':
        return this.unary(node, depth);
      case 'Binary':
        return this.binary(node, depth);
      case 'Logical': {
        const left = this.visit(node.left, depth + 1);
        if (node.op === '??') return left !== null ? left : this.visit(node.right, depth + 1);
        if (node.op === '&&') return isTruthy(left) && isTruthy(this.visit(node.right, depth + 1));
        return isTruthy(left) || isTruthy(this.visit(node.right, depth + 1));
      }
      case 'Conditional':
        return isTruthy(this.visit(node.test, depth + 1))
          ? this.visit(node.consequent, depth + 1)
          : this.visit(node.alternate, depth + 1);
      case 'Call':
        return this.call(node, depth);
    }
  }

  /** Every data read goes through `getPath`, so prototype values can never be reached. */
  private path(node: Extract<ExprNode, { kind: 'Path' }>, depth: number): JsonValue {
    let root: Readonly<Record<string, JsonValue>> = this.ctx.scopes;
    let steps: readonly (string | number)[] = node.steps;
    if (node.object !== undefined) {
      root = { v: this.visit(node.object, depth + 1) };
      steps = ['v', ...node.steps];
    }

    let path = '';
    for (const [i, step] of steps.entries()) {
      if (typeof step === 'number') {
        path += `[${step}]`;
      } else if (IDENTIFIER.test(step)) {
        path += i === 0 ? step : `.${step}`;
      } else {
        return this.warn('expr.path-invalid', `"${step}" is not a readable path step.`, node.span);
      }
    }

    const value = getPath(root, path);
    if (value !== undefined) return value;
    // Missing data is just `null`; only a path `getPath` refuses to read is worth a warning.
    const parsed = parsePath(path);
    if (!parsed.ok) this.warn('expr.path-invalid', parsed.error.message, node.span);
    return null;
  }

  private unary(node: Extract<ExprNode, { kind: 'Unary' }>, depth: number): JsonValue {
    const operand = this.visit(node.operand, depth + 1);
    if (node.op === '!') return !isTruthy(operand);
    if (operand === null) return null;
    if (typeof operand !== 'number') {
      return this.warn('expr.type-mismatch', `Cannot negate ${typeOf(operand)}.`, node.span);
    }
    return operand === 0 ? 0 : -operand;
  }

  private binary(node: Extract<ExprNode, { kind: 'Binary' }>, depth: number): JsonValue {
    const left = this.visit(node.left, depth + 1);
    const right = this.visit(node.right, depth + 1);
    const { op, span } = node;

    if (op === '==') return jsonEquals(left, right);
    if (op === '!=') return !jsonEquals(left, right);

    if (op === '<' || op === '<=' || op === '>' || op === '>=') {
      if (left === null || right === null) return false;
      if (
        (typeof left === 'number' && typeof right === 'number') ||
        (typeof left === 'string' && typeof right === 'string')
      ) {
        if (op === '<') return left < right;
        if (op === '<=') return left <= right;
        if (op === '>') return left > right;
        return left >= right;
      }
      this.warn(
        'expr.type-mismatch',
        `Cannot compare ${typeOf(left)} with ${typeOf(right)}.`,
        span,
      );
      return false;
    }

    if (op === '+' && (typeof left === 'string' || typeof right === 'string')) {
      const a = stringify(left);
      const b = stringify(right);
      if (a === undefined || b === undefined) {
        return this.warn(
          'expr.type-mismatch',
          'A list or an object cannot be joined to text.',
          span,
        );
      }
      return a + b;
    }

    if (left === null || right === null) return null;
    if (typeof left !== 'number' || typeof right !== 'number') {
      return this.warn(
        'expr.type-mismatch',
        `Cannot apply "${op}" to ${typeOf(left)} and ${typeOf(right)}.`,
        span,
      );
    }

    if ((op === '/' || op === '%') && right === 0) {
      return this.warn('expr.division-by-zero', 'Division by zero.', span);
    }
    const result =
      op === '+'
        ? left + right
        : op === '-'
          ? left - right
          : op === '*'
            ? left * right
            : op === '/'
              ? left / right
              : left % right;
    if (!Number.isFinite(result)) {
      return this.warn('expr.not-finite', 'The result is not a finite number.', span);
    }
    // `0 * -1` is `-0`; JSON has no negative zero.
    return result === 0 ? 0 : result;
  }

  private call(node: Extract<ExprNode, { kind: 'Call' }>, depth: number): JsonValue {
    const { name, args, span } = node;
    if (!Object.hasOwn(stdlib, name)) {
      this.fail('expr.unknown-function', `Unknown function "${name}".`, span);
    }
    const fn = stdlib[name];
    if (fn === undefined) return null;
    if (!acceptsArity(fn, args.length)) {
      this.fail(
        'expr.arity',
        `${name}() takes ${arityText(fn)} argument${fn.rest === undefined && fn.params.length === 1 ? '' : 's'}, got ${args.length}.`,
        span,
      );
    }

    const env: StdlibEnv = {
      locale: this.ctx.locale,
      timeZone: this.ctx.timeZone,
      charge: (n) => this.charge(n, span),
    };

    try {
      const result = fn.lazy
        ? fn.run(
            args.map((arg) => () => this.visit(arg, depth + 1)),
            env,
          )
        : this.runEager(fn, args, depth, env, span);
      if (typeof result === 'number' && !Number.isFinite(result)) {
        return this.warn('expr.not-finite', `${name}() did not produce a finite number.`, span);
      }
      return result;
    } catch (error) {
      if (error instanceof StdlibArgError) {
        return this.warn('expr.invalid-argument', `${name}(): ${error.message}.`, span);
      }
      throw error;
    }
  }

  private runEager(
    fn: Extract<NonNullable<(typeof stdlib)[string]>, { lazy?: false }>,
    argNodes: readonly ExprNode[],
    depth: number,
    env: StdlibEnv,
    span: ExprSpan,
  ): JsonValue {
    const values = argNodes.map((arg) => this.visit(arg, depth + 1));
    let sawNull = false;
    for (const [i, value] of values.entries()) {
      const param = paramAt(fn, i);
      if (param === undefined || param.type === 'any') continue;
      if (value === null) {
        sawNull = true;
      } else if (typeOf(value) !== param.type) {
        return this.warn(
          'expr.type-mismatch',
          `${fn.name}() expects a ${param.type} for argument ${i + 1}, got ${typeOf(value)}.`,
          span,
        );
      }
    }
    // A missing value propagates quietly instead of failing the whole expression.
    return sawNull ? null : fn.run(values, env);
  }
}

function start(ctx: DataContext, options: EvaluateOptions | undefined): Evaluation {
  const requested = options?.maxSteps;
  const maxSteps =
    requested === undefined || Number.isNaN(requested)
      ? MAX_EVALUATION_STEPS
      : Math.min(Math.max(requested, 0), MAX_EVALUATION_STEPS);
  return new Evaluation(ctx, maxSteps, options?.diagnostics);
}

function guarded<T>(body: () => T): Result<T, Diagnostic> {
  try {
    return ok(body());
  } catch (error) {
    if (error instanceof EvaluationFailure) return err(error.diagnostic);
    return err({
      code: 'expr.internal',
      message: `Evaluation failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'error',
    });
  }
}

/**
 * Evaluates a parsed expression against `ctx` (docs/expressions.md#semantics). Never throws.
 *
 * `Err` means no meaningful value exists: an unknown function, a wrong argument count, or a
 * breached limit (`expr.limit`: steps, nesting, text length, list size). Problems caused by the
 * data — division by zero, an operand of the wrong type, an unreadable path — evaluate to `null`
 * and are reported through `options.diagnostics`. A missing value (`null`) propagates through
 * arithmetic and stdlib calls as `null` without a warning.
 */
export function evaluate(
  node: ExprNode,
  ctx: DataContext,
  options?: EvaluateOptions,
): Result<JsonValue, Diagnostic> {
  const run = start(ctx, options);
  return guarded(() => run.visit(node, 0));
}

/**
 * Evaluates a parsed `{{ }}` template to text. All interpolations share one step budget. A `null`
 * interpolation is empty text; a list or object is a warning and empty text. Never throws.
 */
export function evaluateTemplate(
  template: TemplateAst,
  ctx: DataContext,
  options?: EvaluateOptions,
): Result<string, Diagnostic> {
  const run = start(ctx, options);
  return guarded(() => {
    let out = '';
    for (const part of template.parts) {
      run.charge(1, part.span);
      out += part.kind === 'Text' ? part.value : run.interpolate(part.expr);
      if (out.length > MAX_RESULT_TEXT) {
        run.fail('expr.limit', `Text is longer than ${MAX_RESULT_TEXT} characters.`, part.span);
      }
    }
    return out;
  });
}
