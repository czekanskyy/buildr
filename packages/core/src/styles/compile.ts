import { walk } from '../document/traverse.ts';
import type { BuilderDocument } from '../document/types.ts';
import { hash } from '../json/hash.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import { compileNodeRules, STYLE_STATES } from './compile-node.ts';
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
const results = new WeakMap<BuilderDocument, WeakMap<Theme, CompiledStyles>>();

export function compileStyles(doc: BuilderDocument, theme: Theme): CompiledStyles {
  // Documents are immutable, so the same document and theme always give the same stylesheet.
  const cached = results.get(doc)?.get(theme);
  if (cached !== undefined) return cached;
  const compiled = build(doc, theme);
  let perTheme = results.get(doc);
  if (perTheme === undefined) {
    perTheme = new WeakMap();
    results.set(doc, perTheme);
  }
  perTheme.set(theme, compiled);
  return compiled;
}

function build(doc: BuilderDocument, theme: Theme): CompiledStyles {
  const diagnostics: Diagnostic[] = [];
  const base: string[] = [];
  const states: string[] = [];
  const byBreakpoint = new Map<string, string[]>(theme.breakpoints.map((bp) => [bp.id, []]));

  for (const node of walk(doc)) {
    if (node.styles === undefined || node.styles === null) continue;
    const rules = compileNodeRules(node.id, node.styles, theme);
    diagnostics.push(...rules.diagnostics);
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
  }

  const layer: string[] = [...base, ...states].map((rule) => `  ${rule}`);
  for (const bp of theme.breakpoints) {
    const rules = byBreakpoint.get(bp.id) ?? [];
    if (rules.length === 0) continue;
    layer.push(`  ${mediaQuery(bp.maxWidth)} {`, ...rules.map((rule) => `    ${rule}`), '  }');
  }

  const parts = [LAYER_ORDER_CSS, compileTokens(theme)];
  if (layer.length > 0) parts.push(`@layer buildr.nodes {\n${layer.join('\n')}\n}`);
  const css = parts.join('\n');
  return { css, hash: hash(css), diagnostics };
}
