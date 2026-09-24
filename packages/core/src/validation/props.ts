import { z } from 'zod';
import { parsePath } from '../data/path.ts';
import type { DataSchema } from '../data/schema.ts';
import { schemaAtPath } from '../data/schema.ts';
import type { BuilderDocument, NodeId, PageNode, Value } from '../document/types.ts';
import type { ExprNode, TemplateAst } from '../expressions/ast.ts';
import { compileExpression, compileTemplate } from '../expressions/compile.ts';
import { collectPathRoots } from '../expressions/roots.ts';
import { typecheck } from '../expressions/typecheck.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import type { DataTypeTag } from '../schema/data-type.ts';
import type { PropDef } from '../schema/kinds/index.ts';
import { validatePropValue } from '../schema/validate.ts';
import { valueSchema } from '../values/schema.ts';
import type { LocaleConfig } from '../values/types.ts';
import type { ValidationIssue } from './types.ts';

/** Names a Loop provides at render time; a schema without them cannot judge such paths. */
const LOOP_SCOPES: readonly string[] = ['item', 'index', 'loop'];

const anyValueSchema = valueSchema(z.unknown());

interface Context {
  readonly registry: RegistryMeta;
  readonly locales: LocaleConfig | undefined;
  readonly dataSchema: DataSchema | undefined;
  readonly out: ValidationIssue[];
}

type Where = readonly (string | number)[];

function report(
  ctx: Context,
  nodeId: NodeId,
  where: Where,
  code: string,
  message: string,
  severity: 'error' | 'warning' = 'error',
  extra: Record<string, string | number> = {},
): void {
  ctx.out.push({
    code,
    message,
    severity,
    blocking: false,
    path: ['nodes', nodeId, ...where],
    details: { nodeId, ...extra },
  });
}

/** Re-reports a nested diagnostic (parser, typechecker) as an issue on `nodeId`. */
function forward(ctx: Context, nodeId: NodeId, where: Where, diagnostic: Diagnostic): void {
  ctx.out.push({
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity,
    blocking: false,
    path: ['nodes', nodeId, ...where],
    details: { ...(diagnostic.details ?? {}), nodeId },
  });
}

/** True when the expression reads a Loop scope the data schema does not declare. */
function dependsOnUndeclaredScope(ast: ExprNode | TemplateAst, schema: DataSchema): boolean {
  for (const root of collectPathRoots(ast)) {
    if (LOOP_SCOPES.includes(root) && !Object.hasOwn(schema.scopes, root)) return true;
  }
  return false;
}

function checkSource(
  ctx: Context,
  nodeId: NodeId,
  where: Where,
  source: string,
  mode: 'formula' | 'template',
  accepts?: readonly DataTypeTag[],
): void {
  const compiled = mode === 'template' ? compileTemplate(source) : compileExpression(source);
  if (!compiled.ok) {
    forward(ctx, nodeId, where, compiled.error);
    return;
  }
  const schema = ctx.dataSchema;
  if (schema === undefined || dependsOnUndeclaredScope(compiled.value.ast, schema)) return;
  const checked = typecheck(compiled.value.ast, schema, accepts === undefined ? {} : { accepts });
  for (const diagnostic of checked.diagnostics) forward(ctx, nodeId, where, diagnostic);
}

function checkBindingPath(ctx: Context, nodeId: NodeId, where: Where, path: string): void {
  const parsed = parsePath(path);
  if (!parsed.ok) {
    forward(ctx, nodeId, where, parsed.error);
    return;
  }
  const schema = ctx.dataSchema;
  if (schema === undefined) return;
  const first = parsed.value[0];
  if (
    first?.kind === 'key' &&
    LOOP_SCOPES.includes(first.key) &&
    !Object.hasOwn(schema.scopes, first.key)
  ) {
    return;
  }
  if (schemaAtPath(schema, path) === undefined) {
    report(
      ctx,
      nodeId,
      where,
      'validation.unknown-binding-path',
      `"${path}" does not exist in the data schema.`,
      'error',
      { bindingPath: path },
    );
  }
}

function checkLocaleKeys(
  ctx: Context,
  nodeId: NodeId,
  where: Where,
  keys: readonly string[],
): void {
  const locales = ctx.locales;
  if (locales === undefined) return;
  for (const key of keys) {
    if (!locales.locales.includes(key)) {
      report(
        ctx,
        nodeId,
        [...where, 'l10n', key],
        'validation.unknown-locale',
        `"${key}" is not a configured language.`,
        'warning',
        { locale: key },
      );
    }
  }
}

function checkStaticValue(
  ctx: Context,
  nodeId: NodeId,
  where: Where,
  def: PropDef,
  value: Extract<Value, { kind: 'static' }>,
): void {
  const main = validatePropValue(def, value.value);
  if (!main.ok) {
    report(ctx, nodeId, [...where, 'value'], 'validation.invalid-prop-value', main.error.message);
  }
  if (value.l10n === undefined) return;
  if (!def.localizable) {
    report(
      ctx,
      nodeId,
      [...where, 'l10n'],
      'validation.not-localizable',
      'This prop cannot be translated.',
    );
    return;
  }
  for (const [locale, translated] of Object.entries(value.l10n)) {
    const checked = validatePropValue(def, translated);
    if (!checked.ok) {
      report(
        ctx,
        nodeId,
        [...where, 'l10n', locale],
        'validation.invalid-prop-value',
        `the "${locale}" translation: ${checked.error.message}`,
        'error',
        { locale },
      );
    }
  }
  checkLocaleKeys(ctx, nodeId, where, Object.keys(value.l10n));
}

function checkDynamicValue(
  ctx: Context,
  nodeId: NodeId,
  where: Where,
  def: PropDef,
  value: Exclude<Value, { kind: 'static' }>,
): void {
  if (def.bindable === false) {
    report(ctx, nodeId, where, 'validation.not-bindable', 'This prop cannot be bound to data.');
    return;
  }
  if (value.fallback !== undefined) {
    const checked = validatePropValue(def, value.fallback);
    if (!checked.ok) {
      report(
        ctx,
        nodeId,
        [...where, 'fallback'],
        'validation.invalid-prop-value',
        `the fallback: ${checked.error.message}`,
      );
    }
  }
  if (value.kind === 'binding') {
    checkBindingPath(ctx, nodeId, [...where, 'path'], value.path);
    return;
  }
  const mode = value.mode === 'template' ? 'template' : 'formula';
  checkSource(ctx, nodeId, [...where, 'expr'], value.expr, mode, def.accepts);
  if (value.l10n === undefined) return;
  if (!def.localizable || mode !== 'template') {
    report(
      ctx,
      nodeId,
      [...where, 'l10n'],
      'validation.not-localizable',
      'Only a localizable prop in template mode can be translated.',
    );
    return;
  }
  for (const [locale, source] of Object.entries(value.l10n)) {
    if (source !== undefined)
      checkSource(ctx, nodeId, [...where, 'l10n', locale], source, 'template');
  }
  checkLocaleKeys(ctx, nodeId, where, Object.keys(value.l10n));
}

function checkNode(ctx: Context, node: PageNode): void {
  const meta = ctx.registry.get(node.type);
  if (meta === undefined) return;
  const props = node.props ?? {};

  for (const [name, value] of Object.entries(props)) {
    const where = ['props', name];
    const def = Object.hasOwn(meta.props, name) ? meta.props[name] : undefined;
    if (def === undefined) {
      report(
        ctx,
        node.id,
        where,
        'validation.unknown-prop',
        `${meta.label} has no "${name}" prop.`,
      );
      continue;
    }
    if (!anyValueSchema.safeParse(value).success) {
      report(ctx, node.id, where, 'validation.invalid-value-shape', 'Not a valid prop value.');
      continue;
    }
    if (value.kind === 'static') checkStaticValue(ctx, node.id, where, def, value);
    else checkDynamicValue(ctx, node.id, where, def, value);
  }

  for (const [name, def] of Object.entries(meta.props)) {
    if (def.required === true && !Object.hasOwn(props, name)) {
      report(
        ctx,
        node.id,
        ['props', name],
        'validation.missing-required-prop',
        `${meta.label} needs its "${name}" prop.`,
        'error',
        { prop: name },
      );
    }
  }

  if (node.visibleIf === undefined) return;
  const parsed = anyValueSchema.safeParse(node.visibleIf);
  if (!parsed.success) {
    report(ctx, node.id, ['visibleIf'], 'validation.invalid-value-shape', 'Not a valid condition.');
    return;
  }
  const condition = parsed.data;
  if (condition.kind === 'binding') {
    checkBindingPath(ctx, node.id, ['visibleIf', 'path'], condition.path);
  } else if (condition.kind === 'expression') {
    const mode = condition.mode === 'template' ? 'template' : 'formula';
    checkSource(ctx, node.id, ['visibleIf', 'expr'], condition.expr, mode);
  }
}

export interface PropsCheckOptions {
  readonly registry: RegistryMeta;
  readonly locales?: LocaleConfig | undefined;
  readonly dataSchema?: DataSchema | undefined;
}

/** Props, `l10n` keys, bindings, expressions and `visibleIf` of every node. */
export function checkProps(doc: BuilderDocument, options: PropsCheckOptions): ValidationIssue[] {
  const ctx: Context = {
    registry: options.registry,
    locales: options.locales,
    dataSchema: options.dataSchema,
    out: [],
  };
  for (const node of Object.values(doc.nodes)) checkNode(ctx, node);
  return ctx.out;
}
