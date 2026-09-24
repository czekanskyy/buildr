import type { DataContext } from '../data/context.ts';
import type { JsonValue } from '../json/json-value.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import type { Result } from '../result/result.ts';
import { ok } from '../result/result.ts';
import type { ExprNode, TemplateAst } from './ast.ts';
import { type EvaluateOptions, evaluate, evaluateTemplate } from './evaluate.ts';
import { parseExpression } from './parser.ts';
import { parseTemplate } from './template.ts';

/** An expression parsed once and ready to evaluate against any number of data contexts. */
export interface CompiledExpression {
  readonly source: string;
  readonly ast: ExprNode;
  readonly evaluate: (ctx: DataContext, options?: EvaluateOptions) => Result<JsonValue, Diagnostic>;
}

/** A `{{ }}` template parsed once and ready to evaluate. */
export interface CompiledTemplate {
  readonly source: string;
  readonly ast: TemplateAst;
  readonly evaluate: (ctx: DataContext, options?: EvaluateOptions) => Result<string, Diagnostic>;
}

/** Parses `source` as an expression. Never throws; a syntax error is an `expr.syntax` / `expr.limit` diagnostic. */
export function compileExpression(source: string): Result<CompiledExpression, Diagnostic> {
  const parsed = parseExpression(source);
  if (!parsed.ok) return parsed;
  const ast = parsed.value;
  return ok({ source, ast, evaluate: (ctx, options) => evaluate(ast, ctx, options) });
}

/** Parses `source` as a `{{ }}` template. Never throws. */
export function compileTemplate(source: string): Result<CompiledTemplate, Diagnostic> {
  const parsed = parseTemplate(source);
  if (!parsed.ok) return parsed;
  const ast = parsed.value;
  return ok({ source, ast, evaluate: (ctx, options) => evaluateTemplate(ast, ctx, options) });
}

/**
 * A bounded least-recently-used cache of compiled sources. Sources that fail to parse are cached
 * too, so a broken formula is not re-parsed on every render. It is an instance the caller owns —
 * there is no module-level cache (docs/ai/architecture-rules.md: no global mutable state).
 */
export interface CompileCache {
  readonly expression: (source: string) => Result<CompiledExpression, Diagnostic>;
  readonly template: (source: string) => Result<CompiledTemplate, Diagnostic>;
  /** Entries currently held, across expressions and templates. */
  readonly size: () => number;
  readonly clear: () => void;
}

export const DEFAULT_COMPILE_CACHE_SIZE = 256;

function lru<V>(capacity: number, make: (source: string) => V) {
  const entries = new Map<string, V>();
  return {
    get(source: string): V {
      const hit = entries.get(source);
      if (hit !== undefined) {
        // Re-insert to mark as most recently used (a Map iterates in insertion order).
        entries.delete(source);
        entries.set(source, hit);
        return hit;
      }
      const value = make(source);
      entries.set(source, value);
      if (entries.size > capacity) {
        const oldest = entries.keys().next();
        if (!oldest.done) entries.delete(oldest.value);
      }
      return value;
    },
    size: () => entries.size,
    clear: () => entries.clear(),
  };
}

/** Creates a compile cache holding at most `capacity` expressions and `capacity` templates. */
export function createCompileCache(capacity = DEFAULT_COMPILE_CACHE_SIZE): CompileCache {
  const limit = Math.max(1, Math.floor(capacity));
  const expressions = lru(limit, compileExpression);
  const templates = lru(limit, compileTemplate);
  return {
    expression: (source) => expressions.get(source),
    template: (source) => templates.get(source),
    size: () => expressions.size() + templates.size(),
    clear: () => {
      expressions.clear();
      templates.clear();
    },
  };
}
