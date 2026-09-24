import { type DataSchema, schemaAtPath } from '../data/schema.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import type { DataType, DataTypeTag } from '../schema/data-type.ts';
import type { ExprNode, ExprSpan, TemplateAst } from './ast.ts';
import { acceptsArity, paramAt, stdlib } from './stdlib/index.ts';
import type { StdlibFunction, StdlibParamType } from './stdlib/types.ts';

/**
 * What the checker knows about a value: a `DataType` from the schema, `null` (the literal), or
 * `unknown` — no schema, a path steered through a `ref`/computed base, or branches that disagree.
 * `unknown` is compatible with everything, so a missing schema never produces a false error.
 */
export type ExprType = DataType | { readonly t: 'unknown' } | { readonly t: 'null' };

export interface TypecheckOptions {
  /**
   * The `PropDef.accepts` of the prop this expression feeds. When set and the inferred type is
   * known, its tag must be one of these (an `unknown` or `null` result always passes).
   */
  readonly accepts?: readonly DataTypeTag[];
}

export interface TypecheckResult {
  /** The inferred result type; `string` for a template. */
  readonly type: ExprType;
  /** Span-tagged (`details.start`/`details.end`) problems; empty when the expression checks out. */
  readonly diagnostics: readonly Diagnostic[];
}

const UNKNOWN: ExprType = { t: 'unknown' };
const NULL: ExprType = { t: 'null' };
const STRING: ExprType = { t: 'string' };
const NUMBER: ExprType = { t: 'number' };
const BOOLEAN: ExprType = { t: 'boolean' };

/** Types whose runtime value is a JSON string. */
function isText(type: ExprType): boolean {
  return type.t === 'string' || type.t === 'url' || type.t === 'enum' || type.t === 'date';
}

/** `unknown` and `null` never cause an error: the first is unknowable, the second propagates at runtime. */
function isLax(type: ExprType): boolean {
  return type.t === 'unknown' || type.t === 'null';
}

function describe(type: ExprType): string {
  return type.t === 'list' ? 'list' : type.t;
}

function matchesParam(type: ExprType, param: StdlibParamType): boolean {
  if (param === 'any' || isLax(type)) return true;
  switch (param) {
    case 'string':
      return isText(type);
    case 'number':
      return type.t === 'number';
    case 'boolean':
      return type.t === 'boolean';
    case 'list':
      return type.t === 'list';
    case 'object':
      // A `ref` points at an entity object; media/link/richText are objects at runtime.
      return (
        type.t === 'object' ||
        type.t === 'ref' ||
        type.t === 'media' ||
        type.t === 'link' ||
        type.t === 'richText'
      );
  }
}

function fromParam(param: StdlibParamType): ExprType {
  switch (param) {
    case 'string':
      return STRING;
    case 'number':
      return NUMBER;
    case 'boolean':
      return BOOLEAN;
    case 'list':
      return { t: 'list', of: { t: 'string' } } satisfies ExprType;
    default:
      return UNKNOWN;
  }
}

/** The type of a value that is either `a` or `b` (`unknown` when they cannot be reconciled). */
function unify(a: ExprType, b: ExprType): ExprType {
  if (a.t === 'null') return b;
  if (b.t === 'null') return a;
  if (a.t === 'unknown' || b.t === 'unknown') return UNKNOWN;
  if (a.t === b.t) return a;
  if (isText(a) && isText(b)) return STRING;
  return UNKNOWN;
}

class Checker {
  readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly schema: DataSchema | undefined) {}

  error(code: string, message: string, span: ExprSpan): ExprType {
    this.diagnostics.push({
      code,
      message,
      severity: 'error',
      details: { start: span[0], end: span[1] },
    });
    return UNKNOWN;
  }

  infer(node: ExprNode): ExprType {
    switch (node.kind) {
      case 'Literal':
        if (node.value === null) return NULL;
        return { t: typeof node.value as 'string' | 'number' | 'boolean' };
      case 'Path':
        return this.path(node);
      case 'Array': {
        const items = node.items.map((item) => this.infer(item));
        const [first, ...rest] = items;
        if (first === undefined) return { t: 'list', of: { t: 'string' } };
        const element = rest.reduce(unify, first);
        return element.t === 'unknown' || element.t === 'null'
          ? { t: 'list', of: { t: 'string' } }
          : { t: 'list', of: element };
      }
      case 'Unary': {
        const operand = this.infer(node.operand);
        if (node.op === '!') return BOOLEAN;
        if (!isLax(operand) && operand.t !== 'number') {
          this.error('expr.type-mismatch', `Cannot negate a ${describe(operand)}.`, node.span);
        }
        return NUMBER;
      }
      case 'Binary':
        return this.binary(node);
      case 'Logical': {
        const left = this.infer(node.left);
        const right = this.infer(node.right);
        return node.op === '??' ? unify(left, right) : BOOLEAN;
      }
      case 'Conditional': {
        this.infer(node.test);
        return unify(this.infer(node.consequent), this.infer(node.alternate));
      }
      case 'Call':
        return this.call(node);
    }
  }

  private path(node: Extract<ExprNode, { kind: 'Path' }>): ExprType {
    if (node.object !== undefined) {
      // The base is checked for its own errors; steps off a computed value are not tracked.
      this.infer(node.object);
      return UNKNOWN;
    }
    if (this.schema === undefined) return UNKNOWN;
    let path = '';
    for (const [i, step] of node.steps.entries()) {
      path += typeof step === 'number' ? `[${step}]` : i === 0 ? step : `.${step}`;
    }
    const field = schemaAtPath(this.schema, path);
    if (field === undefined) {
      return this.error('expr.unknown-path', `"${path}" does not exist in the data.`, node.span);
    }
    return field.type;
  }

  private binary(node: Extract<ExprNode, { kind: 'Binary' }>): ExprType {
    const left = this.infer(node.left);
    const right = this.infer(node.right);
    const { op, span } = node;
    if (op === '==' || op === '!=') return BOOLEAN;

    if (op === '<' || op === '<=' || op === '>' || op === '>=') {
      const comparable =
        isLax(left) ||
        isLax(right) ||
        (left.t === 'number' && right.t === 'number') ||
        (isText(left) && isText(right));
      if (!comparable) {
        this.error(
          'expr.type-mismatch',
          `Cannot compare a ${describe(left)} with a ${describe(right)}.`,
          span,
        );
      }
      return BOOLEAN;
    }

    if (op === '+') {
      if (isText(left) || isText(right)) {
        for (const side of [left, right]) {
          if (!isLax(side) && !isText(side) && side.t !== 'number' && side.t !== 'boolean') {
            return this.error(
              'expr.type-mismatch',
              `A ${describe(side)} cannot be joined to text.`,
              span,
            );
          }
        }
        return STRING;
      }
      if (isLax(left) || isLax(right)) {
        // One side is unknown: it may turn out to be text, so the result is not known either.
        const known = isLax(left) ? right : left;
        if (!isLax(known) && known.t !== 'number' && known.t !== 'boolean') {
          return this.error('expr.type-mismatch', `Cannot add a ${describe(known)}.`, span);
        }
        return UNKNOWN;
      }
    }

    for (const side of [left, right]) {
      if (!isLax(side) && side.t !== 'number') {
        return this.error(
          'expr.type-mismatch',
          `"${op}" needs numbers, found a ${describe(side)}.`,
          span,
        );
      }
    }
    return NUMBER;
  }

  private call(node: Extract<ExprNode, { kind: 'Call' }>): ExprType {
    const { name, args, span } = node;
    // Arguments are always checked, so an unknown path inside an unknown call is still reported.
    const types = args.map((arg) => this.infer(arg));
    if (!Object.hasOwn(stdlib, name)) {
      return this.error('expr.unknown-function', `Unknown function "${name}".`, span);
    }
    const fn: StdlibFunction | undefined = stdlib[name];
    if (fn === undefined) return UNKNOWN;
    if (!acceptsArity(fn, args.length)) {
      return this.error(
        'expr.arity',
        `${name}() does not take ${args.length} argument${args.length === 1 ? '' : 's'}.`,
        span,
      );
    }
    for (const [i, type] of types.entries()) {
      const param = paramAt(fn, i);
      if (param !== undefined && !matchesParam(type, param.type)) {
        this.error(
          'expr.type-mismatch',
          `${name}() expects a ${param.type} for argument ${i + 1}, found a ${describe(type)}.`,
          args[i]?.span ?? span,
        );
      }
    }
    return this.callResult(fn, types);
  }

  private callResult(fn: StdlibFunction, types: readonly ExprType[]): ExprType {
    const first = types[0];
    switch (fn.name) {
      case 'first':
      case 'last':
        return first?.t === 'list' ? first.of : UNKNOWN;
      case 'slice':
        return first?.t === 'list' ? first : UNKNOWN;
      case 'if':
        return unify(types[1] ?? NULL, types[2] ?? NULL);
      case 'coalesce':
        return types.reduce(unify, NULL);
      default:
        return fromParam(fn.returns);
    }
  }
}

/**
 * Infers the result type of an expression (or template) against `schema` without running it
 * (docs/expressions.md#validation): unknown paths, unknown functions, wrong arity, operand and
 * argument type mismatches, and — with `options.accepts` — a result the target prop cannot take.
 * Without a `schema` every path is `unknown` and only function names, arity and the literal/operator
 * structure are checked. Never throws.
 */
export function typecheck(
  node: ExprNode | TemplateAst,
  schema?: DataSchema,
  options?: TypecheckOptions,
): TypecheckResult {
  const checker = new Checker(schema);
  let type: ExprType;
  if (node.kind === 'Template') {
    for (const part of node.parts) {
      if (part.kind !== 'Interpolation') continue;
      const inner = checker.infer(part.expr);
      if (!isLax(inner) && !isText(inner) && inner.t !== 'number' && inner.t !== 'boolean') {
        checker.error(
          'expr.type-mismatch',
          `A ${describe(inner)} cannot be shown as text.`,
          part.expr.span,
        );
      }
    }
    type = STRING;
  } else {
    type = checker.infer(node);
  }

  const accepts = options?.accepts;
  if (accepts !== undefined && !isLax(type) && !accepts.includes(type.t as DataTypeTag)) {
    checker.error(
      'expr.result-type',
      `The result is a ${describe(type)}, but this prop accepts ${accepts.length === 0 ? 'no bindings' : accepts.join(', ')}.`,
      node.span,
    );
  }
  return { type, diagnostics: checker.diagnostics };
}
