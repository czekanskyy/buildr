import { describe, expect, it } from 'vitest';
import { compileNodeDeclarations, compileNodeRules } from './compile-node.ts';
import { parseStyleValue } from './grammar.ts';
import type { NodeStyles } from './index.ts';
import { stylePropertyRegistry } from './properties.ts';
import { nodeStylesSchema } from './schema.ts';
import { defaultTheme } from './theme.ts';

const effects = {
  shadow: '$shadow.md',
  shadowX: '-4px',
  shadowY: '8px',
  shadowBlur: '24px',
  shadowSpread: '-2px',
  shadowColor: '$color.primary',
  shadowInset: 'inset',
  textShadowX: '1px',
  textShadowY: '2px',
  textShadowBlur: '3px',
  textShadowColor: '#FFF',
  blur: '2px',
  brightness: 1.2,
  contrast: 0.9,
  saturate: 2,
  grayscale: 0.1,
  sepia: 0.2,
  hueRotate: '30deg',
  invert: 0.3,
  backdropBlur: '4px',
  translateX: '2rem',
  translateY: '10%',
  rotate: '-20deg',
  scale: 1.2,
  skewX: '2deg',
  skewY: '-3deg',
  transformOrigin: 'top left',
  blendMode: 'multiply',
};
const background = {
  gradient: 'radial-gradient(circle at top left, #fff, $color.primary 100%)',
  repeat: 'no-repeat',
  attachment: 'fixed',
};
const decl = { effects, background };
const css =
  'background-image: radial-gradient(circle at top left, #fff, var(--b-color-primary) 100%); background-repeat: no-repeat; background-attachment: fixed; transform-origin: top left; mix-blend-mode: multiply; box-shadow: var(--b-shadow-md); box-shadow: inset -4px 8px 24px -2px var(--b-color-primary); text-shadow: 1px 2px 3px #fff; filter: blur(2px) brightness(1.2) contrast(0.9) saturate(2) grayscale(0.1) sepia(0.2) hue-rotate(30deg) invert(0.3); backdrop-filter: blur(4px); transform: translateX(2rem) translateY(10%) rotate(-20deg) scale(1.2) skewX(2deg) skewY(-3deg)';

describe('PB-157 style controls', () => {
  it('validates and emits the same deterministic declarations in base, states and breakpoints', () => {
    const styles: NodeStyles = { base: decl, state: { hover: decl }, bp: { mobile: decl } };
    expect(nodeStylesSchema.safeParse(styles).success).toBe(true);
    const result = compileNodeDeclarations(styles, defaultTheme);
    expect(result).toEqual({
      base: css,
      state: { hover: css },
      bp: { mobile: css },
      motion: { base: undefined, bp: {} },
      diagnostics: [],
    });
    expect(compileNodeRules('card', styles, defaultTheme).base).toBe(`.b-card { ${css}; }`);
    const reversed = { effects: Object.fromEntries(Object.entries(effects).reverse()), background };
    expect(compileNodeDeclarations({ base: reversed }, defaultTheme).base).toBe(css);
  });
  for (const [group, values] of Object.entries(decl)) {
    for (const name of Object.keys(values)) {
      const id = `${group}.${name}`;
      it(`${id} rejects all forbidden fragments`, () => {
        const def = stylePropertyRegistry[id];
        if (!def) throw new Error(id);
        for (const fragment of ['url(', 'calc(', ';', '@', '!important', '{', '}']) {
          expect(parseStyleValue(def.grammar, `1px${fragment}`).ok).toBe(false);
          expect(
            nodeStylesSchema.safeParse({ base: { [group]: { [name]: fragment } } }).success,
          ).toBe(false);
        }
      });
    }
  }
  it('rejects invalid ranges, units and enums', () => {
    for (const [name, value] of [
      ['blur', '-1px'],
      ['brightness', 2.1],
      ['invert', 1.1],
      ['scale', 11],
      ['rotate', '361deg'],
      ['skewX', '90deg'],
      ['shadowBlur', '-1px'],
      ['translateX', '1vw'],
      ['shadowInset', 'yes'],
      ['blendMode', 'bogus'],
    ]) {
      expect(
        nodeStylesSchema.safeParse({ base: { effects: { [name as string]: value } } }).success,
      ).toBe(false);
    }
    const grammar = { kind: 'gradient' } as const;
    expect(
      parseStyleValue(grammar, 'linear-gradient(90deg, #FFF, #000)').ok &&
        parseStyleValue(grammar, 'linear-gradient(90deg, #FFF, #000)'),
    ).toEqual({ ok: true, value: 'linear-gradient(90deg, #fff, #000)' });
    for (const value of [
      'radial-gradient(square, #fff, #000)',
      'radial-gradient(circle at anywhere, #fff, #000)',
      'radial-gradient(circle, #fff)',
    ])
      expect(parseStyleValue(grammar, value).ok).toBe(false);
  });
});
