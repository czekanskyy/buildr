/** A half-open `[start, end)` range of UTF-16 offsets into the source text (for editor underlines). */
export type ExprSpan = readonly [start: number, end: number];

export type ExprLiteralValue = string | number | boolean | null;
export type ExprUnaryOp = '!' | '-';
export type ExprBinaryOp = '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=';
export type ExprLogicalOp = '&&' | '||' | '??';

/** A `.key` / `['key']` step (a string) or a `[n]` step (a non-negative integer). */
export type ExprPathStep = string | number;

export interface ExprLiteralNode {
  readonly kind: 'Literal';
  /** Never a negative number: `-1` is a `Unary` over the literal `1`. */
  readonly value: ExprLiteralValue;
  readonly span: ExprSpan;
}

/**
 * A data path. Without `object` it is a bare identifier chain read from the data scopes, and
 * `steps[0]` is that root identifier (`post.title` → `['post', 'title']`). With `object` the steps
 * are applied to the value of that (non-`Path`) expression, e.g. `(cond ? a : b).title` or
 * `[1, 2][0]`. The parser folds a step onto a `Path` base, so `object` is never itself a `Path`.
 */
export interface ExprPathNode {
  readonly kind: 'Path';
  readonly object?: ExprNode;
  readonly steps: readonly ExprPathStep[];
  readonly span: ExprSpan;
}

export interface ExprArrayNode {
  readonly kind: 'Array';
  readonly items: readonly ExprNode[];
  readonly span: ExprSpan;
}

export interface ExprUnaryNode {
  readonly kind: 'Unary';
  readonly op: ExprUnaryOp;
  readonly operand: ExprNode;
  readonly span: ExprSpan;
}

export interface ExprBinaryNode {
  readonly kind: 'Binary';
  readonly op: ExprBinaryOp;
  readonly left: ExprNode;
  readonly right: ExprNode;
  readonly span: ExprSpan;
}

export interface ExprLogicalNode {
  readonly kind: 'Logical';
  readonly op: ExprLogicalOp;
  readonly left: ExprNode;
  readonly right: ExprNode;
  readonly span: ExprSpan;
}

export interface ExprConditionalNode {
  readonly kind: 'Conditional';
  readonly test: ExprNode;
  readonly consequent: ExprNode;
  readonly alternate: ExprNode;
  readonly span: ExprSpan;
}

/**
 * A call to a named function. The parser accepts any identifier; whether `name` is an allowlisted
 * stdlib function (and its arity) is checked by the evaluator and the typechecker.
 */
export interface ExprCallNode {
  readonly kind: 'Call';
  readonly name: string;
  readonly args: readonly ExprNode[];
  readonly span: ExprSpan;
}

export type ExprNode =
  | ExprLiteralNode
  | ExprPathNode
  | ExprArrayNode
  | ExprUnaryNode
  | ExprBinaryNode
  | ExprLogicalNode
  | ExprConditionalNode
  | ExprCallNode;

export interface TemplateTextPart {
  readonly kind: 'Text';
  readonly value: string;
  readonly span: ExprSpan;
}

export interface TemplateInterpolationPart {
  readonly kind: 'Interpolation';
  readonly expr: ExprNode;
  /** Covers the whole `{{ ... }}`, delimiters included. */
  readonly span: ExprSpan;
}

export type TemplatePart = TemplateTextPart | TemplateInterpolationPart;

/** A parsed `{{ }}` template: literal text interleaved with interpolated expressions. */
export interface TemplateAst {
  readonly kind: 'Template';
  readonly parts: readonly TemplatePart[];
  readonly span: ExprSpan;
}

/** Max source length of an expression (or of a whole template), in UTF-16 code units. */
export const MAX_EXPRESSION_LENGTH = 2000;
/** Max tokens in one expression. */
export const MAX_EXPRESSION_TOKENS = 500;
/** Max depth of an expression's AST. */
export const MAX_EXPRESSION_DEPTH = 32;

const ZERO_SPAN: ExprSpan = [0, 0];

/**
 * Returns a copy of `node` with every span zeroed — the equality basis for round-trip tests, since
 * a re-parsed normalized source has different offsets than the original.
 */
export function stripSpans<T extends ExprNode | TemplateAst>(node: T): T {
  return strip(node) as T;
}

function strip(node: ExprNode | TemplateAst | TemplatePart): ExprNode | TemplateAst | TemplatePart {
  switch (node.kind) {
    case 'Literal':
      return { kind: 'Literal', value: node.value, span: ZERO_SPAN };
    case 'Path':
      return node.object === undefined
        ? { kind: 'Path', steps: node.steps, span: ZERO_SPAN }
        : {
            kind: 'Path',
            object: strip(node.object) as ExprNode,
            steps: node.steps,
            span: ZERO_SPAN,
          };
    case 'Array':
      return { kind: 'Array', items: node.items.map((n) => strip(n) as ExprNode), span: ZERO_SPAN };
    case 'Unary':
      return {
        kind: 'Unary',
        op: node.op,
        operand: strip(node.operand) as ExprNode,
        span: ZERO_SPAN,
      };
    case 'Binary':
      return {
        kind: 'Binary',
        op: node.op,
        left: strip(node.left) as ExprNode,
        right: strip(node.right) as ExprNode,
        span: ZERO_SPAN,
      };
    case 'Logical':
      return {
        kind: 'Logical',
        op: node.op,
        left: strip(node.left) as ExprNode,
        right: strip(node.right) as ExprNode,
        span: ZERO_SPAN,
      };
    case 'Conditional':
      return {
        kind: 'Conditional',
        test: strip(node.test) as ExprNode,
        consequent: strip(node.consequent) as ExprNode,
        alternate: strip(node.alternate) as ExprNode,
        span: ZERO_SPAN,
      };
    case 'Call':
      return {
        kind: 'Call',
        name: node.name,
        args: node.args.map((n) => strip(n) as ExprNode),
        span: ZERO_SPAN,
      };
    case 'Text':
      return { kind: 'Text', value: node.value, span: ZERO_SPAN };
    case 'Interpolation':
      return { kind: 'Interpolation', expr: strip(node.expr) as ExprNode, span: ZERO_SPAN };
    case 'Template':
      return {
        kind: 'Template',
        parts: node.parts.map((p) => strip(p) as TemplatePart),
        span: ZERO_SPAN,
      };
  }
}
