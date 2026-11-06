import { parse } from 'css-tree';
import { describe, expect, it } from 'vitest';
import type { NodeStyles } from '../document/style-types.ts';
import type { BuilderDocument } from '../document/types.ts';
import { compileStyles } from './compile.ts';
import { compileNodeRules } from './compile-node.ts';
import { parseStyleValue } from './grammar.ts';
import { getStyleProperty } from './properties.ts';
import { nodeStylesSchema } from './schema.ts';
import { defaultTheme } from './theme.ts';

function docOf(styles: NodeStyles): BuilderDocument {
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: ['n1'] } },
      n1: { id: 'n1', type: 'buildr/box', styles },
    },
    components: {},
  } as unknown as BuilderDocument;
}

const motion = (group: Record<string, unknown>): NodeStyles =>
  ({ base: { motion: group } }) as unknown as NodeStyles;

function cssErrors(css: string): string[] {
  const errors: string[] = [];
  parse(css, { onParseError: (error) => errors.push(error.message) });
  return errors;
}

describe('motion properties (ADR-027)', () => {
  it('accepts enums and bounded numbers only', () => {
    const grammar = (name: string) => getStyleProperty('motion', name)?.grammar;
    const ok = (name: string, value: unknown) => {
      const g = grammar(name);
      return g !== undefined && parseStyleValue(g, value).ok;
    };
    expect(ok('entrance', 'zoom')).toBe(true);
    expect(ok('entrance', 'rotate')).toBe(false);
    expect(ok('entrance', 'fade; animation: x')).toBe(false);
    expect(ok('entranceDuration', '5000ms')).toBe(true);
    expect(ok('entranceDuration', '5001ms')).toBe(false);
    expect(ok('entranceDuration', '-1ms')).toBe(false);
    expect(ok('entranceDuration', '1s')).toBe(false);
    expect(ok('entranceDelay', '10px')).toBe(false);
    expect(ok('entranceEasing', 'cubic-bezier(0,0,0,0)')).toBe(false);
    expect(ok('scrollParallax', '200px')).toBe(true);
    expect(ok('scrollParallax', '201px')).toBe(false);
    expect(ok('scrollParallax', 'var(--x)')).toBe(false);
    expect(ok('hover', 'spin')).toBe(false);
  });

  it('is part of the node styles schema, in base and breakpoints but never in a state', () => {
    expect(nodeStylesSchema.safeParse(motion({ entrance: 'fade', hover: 'lift' })).success).toBe(
      true,
    );
    expect(
      nodeStylesSchema.safeParse({ bp: { mobile: { motion: { entrance: 'none' } } } }).success,
    ).toBe(true);
    expect(nodeStylesSchema.safeParse(motion({ entrance: 'spin' })).success).toBe(false);
    expect(nodeStylesSchema.safeParse(motion({ unknown: 'x' })).success).toBe(false);
    expect(
      nodeStylesSchema.safeParse({ state: { hover: { motion: { hover: 'lift' } } } }).success,
    ).toBe(false);
  });
});

describe('motion compilation', () => {
  it('compiles an entrance to keyframes and a reduced-motion guarded rule', () => {
    const { css, diagnostics } = compileStyles(
      docOf(motion({ entrance: 'slide', entranceDirection: 'left', entranceDuration: '400ms' })),
      defaultTheme,
    );
    expect(diagnostics).toEqual([]);
    expect(css).toContain('@keyframes b-m-slide-left { from { opacity: 0; translate: 24px 0; } }');
    expect(css).toContain('@media (prefers-reduced-motion: no-preference) {');
    expect(css).toContain(
      '.b-n1 { animation-name: b-m-slide-left; animation-duration: 400ms; animation-timing-function: ease-out; animation-delay: 0ms; animation-fill-mode: backwards; }',
    );
    expect(css).not.toContain('animation-timeline');
    expect(cssErrors(css)).toEqual([]);
  });

  it('keeps the finished entrance equal to the base style (no forwards fill)', () => {
    const { css } = compileStyles(docOf(motion({ entrance: 'fade' })), defaultTheme);
    expect(css).not.toMatch(/animation-fill-mode: (both|forwards)/);
  });

  it('puts scroll motion behind @supports and adds no timeline outside it', () => {
    const { css } = compileStyles(
      docOf(motion({ scrollReveal: 'slide', scrollParallax: '40px' })),
      defaultTheme,
    );
    const outside = css.slice(0, css.indexOf('@supports'));
    expect(css).toContain('@supports (animation-timeline: view()) {');
    expect(outside).not.toContain('animation-timeline');
    expect(css).toContain('animation-name: b-m-slide-up, b-m-parallax');
    expect(css).toContain('animation-timeline: view(), view()');
    expect(css).toContain('animation-range: entry 0% entry 60%, cover 0% cover 100%');
    expect(css).toContain('--b-parallax: 40px');
    expect(css).toContain('@keyframes b-m-parallax');
    expect(cssErrors(css)).toEqual([]);
  });

  it('combines an entrance and a scroll reveal in one list', () => {
    const { css } = compileStyles(
      docOf(motion({ entrance: 'fade', scrollReveal: 'zoom' })),
      defaultTheme,
    );
    expect(css).toContain('animation-name: b-m-fade, b-m-zoom');
    expect(css).toContain('animation-timeline: auto, view()');
  });

  it('compiles hover to a transition and a (hover: hover) rule', () => {
    const { css } = compileStyles(
      docOf(motion({ hover: 'grow', hoverDuration: '300ms' })),
      defaultTheme,
    );
    expect(css).toContain('.b-n1 { transition: scale 300ms ease-out; }');
    expect(css).toContain('@media (hover: hover) { .b-n1:hover { scale: 1.05; } }');
    expect(cssErrors(css)).toEqual([]);
  });

  it('emits all motion inside the reduced-motion query so that "reduce" restores the static state', () => {
    const { css } = compileStyles(
      docOf(motion({ entrance: 'zoom', hover: 'lift', scrollReveal: 'fade' })),
      defaultTheme,
    );
    const layer = css.slice(css.indexOf('@layer buildr.nodes'));
    const body = layer.replace(/@keyframes [^\n]*\n/g, '');
    const start = body.indexOf('@media (prefers-reduced-motion: no-preference)');
    expect(start).toBeGreaterThan(-1);
    // Everything that animates sits after that opening, in one block: no rule precedes it.
    expect(body.slice(0, start)).not.toMatch(/animation|transition/);
  });

  it('emits nothing for none, or for an empty group', () => {
    for (const group of [{}, { entrance: 'none', hover: 'none', scrollReveal: 'none' }]) {
      const { css, diagnostics } = compileStyles(docOf(motion(group)), defaultTheme);
      expect(diagnostics).toEqual([]);
      expect(css).not.toContain('@keyframes');
      expect(css).not.toContain('prefers-reduced-motion');
    }
  });

  it('lets a breakpoint switch the motion off', () => {
    const styles = {
      base: { motion: { entrance: 'fade', hover: 'lift' } },
      bp: { mobile: { motion: { entrance: 'none', hover: 'none' } } },
    } as unknown as NodeStyles;
    const { css } = compileStyles(docOf(styles), defaultTheme);
    const mobile = css.slice(css.indexOf('@media (max-width: 767.98px)'));
    expect(mobile).toContain('animation-name: none');
    expect(mobile).toContain('translate: none; scale: none; rotate: none');
    expect(cssErrors(css)).toEqual([]);
  });

  it('skips an invalid value with a diagnostic, never emitting it', () => {
    const rules = compileNodeRules(
      'n1',
      motion({ entrance: 'slide', entranceDuration: '9999ms', entranceEasing: 'x; y' }),
      defaultTheme,
    );
    expect(rules.diagnostics.map((d) => d.details?.['property'])).toEqual([
      'base.motion.entranceDuration',
      'base.motion.entranceEasing',
    ]);
    expect(JSON.stringify({ ...rules, diagnostics: [] })).not.toContain('9999');
    expect(rules.motion.base).toContain('animation-duration: 600ms');
  });

  it('refuses motion in a pseudo-state', () => {
    const rules = compileNodeRules(
      'n1',
      { state: { hover: { motion: { entrance: 'fade' } } } } as unknown as NodeStyles,
      defaultTheme,
    );
    expect(rules.diagnostics.map((d) => d.code)).toEqual(['style.not-allowed-in-state']);
    expect(rules.motion.base).toBeUndefined();
  });

  it('is deterministic and independent of key order', () => {
    const a = compileStyles(docOf(motion({ entrance: 'fade', hover: 'lift' })), defaultTheme);
    const b = compileStyles(docOf(motion({ hover: 'lift', entrance: 'fade' })), defaultTheme);
    expect(a.css).toBe(b.css);
    expect(a.hash).toBe(b.hash);
  });

  it('shares one keyframes rule between nodes', () => {
    const doc = {
      schemaVersion: 1,
      root: 'root',
      nodes: {
        root: { id: 'root', type: 'buildr/page', slots: { default: ['n1', 'n2'] } },
        n1: { id: 'n1', type: 'buildr/box', styles: motion({ entrance: 'fade' }) },
        n2: { id: 'n2', type: 'buildr/box', styles: motion({ entrance: 'fade' }) },
      },
      components: {},
    } as unknown as BuilderDocument;
    const { css } = compileStyles(doc, defaultTheme);
    expect(css.match(/@keyframes b-m-fade/g)).toHaveLength(1);
  });
});
