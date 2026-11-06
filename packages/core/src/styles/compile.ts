import { authorCodeEnabled, type HostCapabilities } from '../author/capabilities.ts';
import { compileCustomCss } from '../author/css.ts';
import { walk } from '../document/traverse.ts';
import type { BuilderDocument } from '../document/types.ts';
import { hash } from '../json/hash.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import { keyframesRule } from './compile-motion.ts';
import { compileNodeRules, nodeClassName, STYLE_STATES } from './compile-node.ts';
import type { Theme } from './theme.ts';
import { compileTokens, LAYER_ORDER_CSS } from './tokens.ts';

export interface CompiledStyles {
  /** The whole stylesheet: layer order, tokens, then node rules. */
  readonly css: string;
  /** Content hash of `css` (which contains the theme's tokens), for a content-addressed cache key. */
  readonly hash: string;
  readonly diagnostics: readonly Diagnostic[];
}

/** `max-width` at which a breakpoint ends, so a viewport of exactly `maxWidth` px still matches (docs/responsive.md). */
function mediaQuery(maxWidth: number): string {
  return `@media (max-width: ${(maxWidth + 0.98).toFixed(2)}px)`;
}

/**
 * Compiles every node's styles to one stylesheet (docs/styles.md#css-strategy). Emission order:
 * layer order, tokens, then `@layer buildr.nodes` holding all `base` rules in document pre-order,
 * then pseudo-state rules, then one `@media` block per theme breakpoint (widest first) gathering
 * every node's overrides. Deterministic — the same document and theme always give the identical
 * string — and every declaration is the re-rendered output of a property grammar, so no
 * `!important` and nothing outside the grammar can appear. A breakpoint id the theme does not
 * define is reported and skipped. Never throws. Memoized per node
 * (on the identity of its `styles`) and per document, so an edit recompiles only what changed.
 */
const results = new WeakMap<
  BuilderDocument,
  WeakMap<Theme, { off?: CompiledStyles; on?: CompiledStyles }>
>();

export interface CompileStylesOptions {
  /**
   * What the host permits. Node `customCss` (ADR-026) is compiled into `@layer buildr.custom`
   * only when `authorCode` is exactly `true`; without it the field is ignored and reported, so
   * a document edited outside the commands cannot get custom CSS onto a page.
   */
  readonly capabilities?: HostCapabilities | undefined;
}

export function compileStyles(
  doc: BuilderDocument,
  theme: Theme,
  options: CompileStylesOptions = {},
): CompiledStyles {
  // Documents are immutable, so the same document, theme and capability always give the same stylesheet.
  const author = authorCodeEnabled(options.capabilities);
  const slot = author ? 'on' : 'off';
  const cached = results.get(doc)?.get(theme)?.[slot];
  if (cached !== undefined) return cached;
  const compiled = build(doc, theme, author);
  let perTheme = results.get(doc);
  if (perTheme === undefined) {
    perTheme = new WeakMap();
    results.set(doc, perTheme);
  }
  const entry = perTheme.get(theme) ?? {};
  entry[slot] = compiled;
  perTheme.set(theme, entry);
  return compiled;
}

/** A rule that may span several lines, indented line by line. */
function indent(block: string, prefix: string): string[] {
  return block.split('\n').map((line) => `${prefix}${line}`);
}

function build(doc: BuilderDocument, theme: Theme, author: boolean): CompiledStyles {
  const diagnostics: Diagnostic[] = [];
  const base: string[] = [];
  const states: string[] = [];
  const motion: string[] = [];
  const keyframes = new Set<string>();
  const custom: string[] = [];
  const byBreakpoint = new Map<string, string[]>(theme.breakpoints.map((bp) => [bp.id, []]));

  for (const node of walk(doc)) {
    if (typeof node.customCss === 'string') {
      if (!author) {
        diagnostics.push({
          code: 'author.not-permitted',
          message: `Node "${node.id}" has custom CSS, which this host does not allow; it is ignored.`,
          severity: 'warning',
          details: { nodeId: node.id },
        });
      } else {
        const compiled = compileCustomCss(`.${nodeClassName(node.id)}`, node.customCss);
        for (const message of compiled.errors) {
          diagnostics.push({
            code: 'author.css-rejected',
            message: `Node "${node.id}": ${message}`,
            severity: 'warning',
            details: { nodeId: node.id },
          });
        }
        if (compiled.css !== '') {
          custom.push(compiled.css);
          // Audit trail (ADR-026): custom CSS is on the page.
          diagnostics.push({
            code: 'author.css-applied',
            message: `Node "${node.id}" has custom CSS.`,
            severity: 'warning',
            details: { nodeId: node.id },
          });
        }
      }
    }
    if (node.styles === undefined || node.styles === null) continue;
    const rules = compileNodeRules(node.id, node.styles, theme);
    diagnostics.push(...rules.diagnostics);
    for (const name of rules.keyframes) keyframes.add(name);
    if (rules.motion.base !== undefined) motion.push(rules.motion.base);
    if (rules.base !== undefined) base.push(rules.base);
    for (const name of STYLE_STATES) {
      const stateRule = rules.state[name];
      if (stateRule !== undefined) states.push(stateRule);
    }
    for (const [id, css] of Object.entries(rules.bp)) {
      const bucket = byBreakpoint.get(id);
      if (bucket === undefined) {
        diagnostics.push({
          code: 'style.unknown-breakpoint',
          message: `the theme has no breakpoint "${id}"`,
          severity: 'warning',
          details: { nodeId: node.id, breakpoint: id },
        });
      } else {
        bucket.push(css);
      }
    }
    for (const [id, css] of Object.entries(rules.motion.bp)) {
      byBreakpoint.get(id)?.push(css);
    }
  }

  const layer: string[] = [...base, ...states].map((rule) => `  ${rule}`);
  for (const name of [...keyframes].sort()) layer.push(`  ${keyframesRule(name)}`);
  for (const block of motion) layer.push(...indent(block, '  '));
  for (const bp of theme.breakpoints) {
    const rules = byBreakpoint.get(bp.id) ?? [];
    if (rules.length === 0) continue;
    layer.push(
      `  ${mediaQuery(bp.maxWidth)} {`,
      ...rules.flatMap((rule) => indent(rule, '    ')),
      '  }',
    );
  }

  const parts = [LAYER_ORDER_CSS, compileTokens(theme)];
  if (layer.length > 0) parts.push(`@layer buildr.nodes {\n${layer.join('\n')}\n}`);
  if (custom.length > 0) {
    // After `buildr.nodes`, so author rules win over the node's own styles; still inside the `buildr` layer.
    const lines = custom.flatMap((css) => indent(css, '  '));
    parts.push(`@layer buildr.custom {\n${lines.join('\n')}\n}`);
  }
  const css = parts.join('\n');
  return { css, hash: hash(css), diagnostics };
}
