import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import { TOKEN_SCALES, type TokenScale } from './grammar.ts';
import type { Theme } from './theme.ts';

/** The cascade layers, declared once and first (docs/styles.md#css-strategy). */
export const LAYER_ORDER_CSS =
  '@layer buildr.reset, buildr.tokens, buildr.components, buildr.nodes;';

function kebab(scale: string): string {
  return scale.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** The custom property a token is emitted as: `--b-<scale>-<name>`. */
export function tokenVariableName(scale: TokenScale, name: string): string {
  return `--b-${kebab(scale)}-${name}`;
}

/**
 * Emits the theme's tokens as custom properties inside `@layer buildr.tokens { :root { ... } }`
 * (docs/styles.md#theme-and-tokens). Deterministic: scales in a fixed order, tokens sorted by
 * name, two-space indentation, one declaration per line — the same theme always yields the same
 * string, whatever order its keys were written in. A theme with no tokens yields an empty layer
 * rule.
 */
export function compileTokens(theme: Theme): string {
  const lines: string[] = [];
  for (const scale of TOKEN_SCALES) {
    const values = theme.tokens[scale];
    for (const name of Object.keys(values).sort()) {
      lines.push(`    ${tokenVariableName(scale, name)}: ${values[name]};`);
    }
  }
  if (lines.length === 0) return '@layer buildr.tokens {\n}';
  return `@layer buildr.tokens {\n  :root {\n${lines.join('\n')}\n  }\n}`;
}

export interface ResolvedTokenRef {
  readonly scale: TokenScale;
  readonly name: string;
  /** The theme's value for the token. */
  readonly value: string;
  /** What the token compiles to in a declaration: `var(--b-space-4)`. */
  readonly cssVar: string;
}

const TOKEN_REF = /^\$([A-Za-z]+)\.([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/**
 * Looks up a `$scale.name` reference in `theme`. `Err` (`theme.unknown-token`) for a malformed
 * reference, an unknown scale, or a token the theme does not define — the grammar accepts any
 * well-formed token, so this is where "does it exist" is answered. Never throws.
 */
export function resolveTokenRef(theme: Theme, ref: string): Result<ResolvedTokenRef, Diagnostic> {
  const match = typeof ref === 'string' ? TOKEN_REF.exec(ref) : null;
  const scale = match?.[1] as TokenScale | undefined;
  const name = match?.[2];
  if (
    match === null ||
    scale === undefined ||
    name === undefined ||
    !(TOKEN_SCALES as readonly string[]).includes(scale)
  ) {
    return err({
      code: 'theme.unknown-token',
      message: `"${String(ref).slice(0, 40)}" is not a token reference like $space.4.`,
      severity: 'error',
    });
  }
  const values = theme.tokens[scale];
  if (!Object.hasOwn(values, name)) {
    return err({
      code: 'theme.unknown-token',
      message: `The theme has no token ${ref}.`,
      severity: 'error',
      details: { scale, name },
    });
  }
  return ok({
    scale,
    name,
    value: values[name] as string,
    cssVar: `var(${tokenVariableName(scale, name)})`,
  });
}
