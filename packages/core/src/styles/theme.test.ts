import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseStyleValue, type StyleGrammar } from './grammar.ts';
import { defaultTheme, defineTheme, MAX_TOKENS_PER_SCALE, validateTheme } from './theme.ts';
import { compileTokens, LAYER_ORDER_CSS, resolveTokenRef, tokenVariableName } from './tokens.ts';

const BP = [
  { id: 'tablet', maxWidth: 1023 },
  { id: 'mobile', maxWidth: 767 },
];

const errors = (input: unknown) => {
  const result = validateTheme(input as never);
  return result.ok ? [] : result.error.map((d) => `${d.path?.join('.')}: ${d.message}`);
};

describe('defineTheme', () => {
  it('normalizes token values and freezes the theme', () => {
    const theme = defineTheme({
      breakpoints: BP,
      tokens: {
        color: { primary: '#ABC', accent: 'rgb(1, 2, 3)' },
        space: { 0: '0', 4: '1.0rem' },
        fontWeight: { bold: '700', regular: 400 },
        lineHeight: { normal: '1.5' },
      },
    });
    expect(theme.tokens.color).toEqual({ primary: '#abc', accent: 'rgb(1 2 3)' });
    expect(theme.tokens.space).toEqual({ 0: '0', 4: '1rem' });
    expect(theme.tokens.fontWeight).toEqual({ bold: '700', regular: '400' });
    expect(theme.tokens.lineHeight).toEqual({ normal: '1.5' });
    expect(theme.tokens.radius).toEqual({});
    expect(Object.isFrozen(theme)).toBe(true);
    expect(Object.isFrozen(theme.tokens.color)).toBe(true);
    expect(Object.isFrozen(theme.breakpoints[0])).toBe(true);
  });

  it('does not keep a reference to the input', () => {
    const color = { primary: '#fff' };
    const theme = defineTheme({ breakpoints: [], tokens: { color } });
    color.primary = '#000';
    expect(theme.tokens.color.primary).toBe('#fff');
  });

  it('throws with every problem for an invalid theme', () => {
    expect(() =>
      defineTheme({ breakpoints: [], tokens: { color: { primary: 'red', 'Bad Name': '#fff' } } }),
    ).toThrow(/tokens\.color\.primary.*tokens\.color\.Bad Name/s);
  });

  it('ships a valid default theme with the documented tokens', () => {
    expect(defaultTheme.breakpoints).toEqual(BP);
    const names = (scale: keyof typeof defaultTheme.tokens) =>
      Object.keys(defaultTheme.tokens[scale]);
    expect(names('color').sort()).toEqual(
      [
        'primary',
        'on-primary',
        'surface',
        'surface-alt',
        'text',
        'text-muted',
        'border',
        'focus',
        'danger',
        'success',
      ].sort(),
    );
    expect(names('space').sort()).toEqual(
      ['0', '1', '2', '3', '4', '6', '8', '12', '16', '24'].sort(),
    );
    expect(names('radius').sort()).toEqual(['full', 'lg', 'md', 'none', 'sm']);
    expect(names('shadow').sort()).toEqual(['lg', 'md', 'sm']);
    expect(names('fontFamily').sort()).toEqual(['body', 'heading', 'mono']);
    expect(names('fontSize').sort()).toEqual([
      '2xl',
      '3xl',
      '4xl',
      '5xl',
      'lg',
      'md',
      'sm',
      'xl',
      'xs',
    ]);
    expect(names('fontWeight').sort()).toEqual(['bold', 'medium', 'regular', 'semibold']);
    expect(names('lineHeight').sort()).toEqual(['normal', 'relaxed', 'tight']);
    expect(names('container').sort()).toEqual(['lg', 'md', 'sm', 'xl']);
    expect(names('transition').sort()).toEqual(['fast', 'normal']);
  });
});

describe('validateTheme: breakpoints', () => {
  const theme = (breakpoints: unknown) => ({ breakpoints, tokens: {} });

  it('accepts none, one, or several strictly decreasing', () => {
    expect(errors(theme([]))).toEqual([]);
    expect(errors(theme([{ id: 'mobile', maxWidth: 600 }]))).toEqual([]);
    expect(errors(theme([...BP, { id: 'small', maxWidth: 480 }]))).toEqual([]);
  });

  it.each([
    [
      'equal widths',
      [
        { id: 'a', maxWidth: 800 },
        { id: 'b', maxWidth: 800 },
      ],
      /strictly decreasing/,
    ],
    [
      'increasing widths',
      [
        { id: 'a', maxWidth: 700 },
        { id: 'b', maxWidth: 800 },
      ],
      /strictly decreasing/,
    ],
    [
      'duplicate ids',
      [
        { id: 'a', maxWidth: 800 },
        { id: 'a', maxWidth: 700 },
      ],
      /duplicate/,
    ],
    ['bad id', [{ id: 'Tablet', maxWidth: 800 }], /id must be/],
    ['numeric id', [{ id: '1', maxWidth: 800 }], /id must be/],
    ['fractional width', [{ id: 'a', maxWidth: 800.5 }], /whole number/],
    ['tiny width', [{ id: 'a', maxWidth: 10 }], /whole number/],
    ['huge width', [{ id: 'a', maxWidth: 99999 }], /whole number/],
    ['string width', [{ id: 'a', maxWidth: '800' }], /whole number/],
    ['not a list', { id: 'a' }, /must be a list/],
    [
      'too many',
      Array.from({ length: 9 }, (_, i) => ({ id: `b${i}`, maxWidth: 2000 - i * 100 })),
      /at most 8/,
    ],
  ])('rejects %s', (_name, breakpoints, message) => {
    expect(errors(theme(breakpoints)).join('\n')).toMatch(message);
  });
});

describe('validateTheme: tokens', () => {
  const tokens = (t: unknown) => ({ breakpoints: [], tokens: t });

  it.each([
    ['unknown scale', { spacing: { a: '1px' } }, /tokens\.spacing.*unknown token scale/],
    ['scale not an object', { color: 'red' }, /tokens\.color.*must be an object/],
    ['scale is a list', { color: [] }, /must be an object/],
    ['tokens not an object', 'x', /tokens: must be an object/],
    ['upper-case name', { color: { Primary: '#fff' } }, /token name/],
    ['name with underscore', { color: { my_color: '#fff' } }, /token name/],
    ['name with dot', { color: { 'a.b': '#fff' } }, /token name/],
    ['prototype name', { color: { __proto__x: '#fff' } }, /token name/],
    ['long name', { color: { ['a'.repeat(33)]: '#fff' } }, /token name/],
    ['double dash', { color: { 'a--b': '#fff' } }, /token name/],
    ['boolean value', { color: { a: true } }, /string or a number/],
    ['null value', { color: { a: null } }, /string or a number/],
    ['token reference', { color: { a: '$color.b' } }, /cannot refer to another token/],
    ['named color', { color: { a: 'red' } }, /color token/],
    ['injection in color', { color: { a: '#fff;}body{' } }, /never allowed/],
    ['url in shadow', { shadow: { a: '0 0 1px url(x)' } }, /never allowed/],
    ['negative space', { space: { a: '-1rem' } }, /length/],
    ['bad unit', { space: { a: '1vw' } }, /length/],
    ['bad weight', { fontWeight: { a: 1000 } }, /number from 100 to 900/],
    ['fractional weight', { fontWeight: { a: 450.5 } }, /number from 100 to 900/],
    ['font with quote', { fontFamily: { a: '"Inter", sans-serif' } }, /never allowed/],
    ['font keyword', { fontFamily: { a: 'inherit' } }, /fontFamily/],
    ['transition too long', { transition: { a: '10s ease' } }, /transition/],
    ['transition with property junk', { transition: { a: 'width 1s' } }, /transition/],
  ])('rejects %s', (_name, t, message) => {
    expect(errors(tokens(t)).join('\n')).toMatch(message);
  });

  it('limits the number of tokens in a scale', () => {
    const many = Object.fromEntries(
      Array.from({ length: MAX_TOKENS_PER_SCALE + 1 }, (_, i) => [`t${i}`, '1px']),
    );
    expect(errors(tokens({ space: many })).join('\n')).toMatch(/at most 64 tokens/);
    expect(
      errors(tokens({ space: Object.fromEntries(Object.entries(many).slice(0, 64)) })),
    ).toEqual([]);
  });

  it('reports every problem at once, each with a path', () => {
    const list = errors({
      breakpoints: [{ id: 'X', maxWidth: 1 }],
      tokens: { color: { a: 'nope' }, radius: { B: '1px' } },
    });
    expect(list).toHaveLength(3);
    expect(list.some((line) => line.startsWith('breakpoints.0'))).toBe(true);
    expect(list.some((line) => line.startsWith('tokens.color.a'))).toBe(true);
    expect(list.some((line) => line.startsWith('tokens.radius.B'))).toBe(true);
  });

  it('never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        expect(() => validateTheme(value as never)).not.toThrow();
      }),
      { numRuns: 300 },
    );
  });
});

describe('theme-only grammars', () => {
  const css = (grammar: StyleGrammar, input: unknown) => {
    const result = parseStyleValue(grammar, input);
    return result.ok ? result.value : undefined;
  };

  it('shadow', () => {
    const g: StyleGrammar = { kind: 'shadow' };
    expect(css(g, 'none')).toBe('none');
    expect(css(g, '0 1px 2px rgba(0, 0, 0, 0.08)')).toBe('0 1px 2px rgb(0 0 0 / 0.08)');
    expect(css(g, 'inset 0 2px 4px 1px #000')).toBe('inset 0 2px 4px 1px #000');
    expect(css(g, '0 1px #FFF, 0 2px 8px rgb(0 0 0 / 50%)')).toBe(
      '0 1px #fff, 0 2px 8px rgb(0 0 0 / 0.5)',
    );
    for (const bad of [
      '0 1px',
      '1px #000',
      '0 0 -2px #000',
      '0 0 1px 2px 3px #000',
      '0 0 1px red',
      '0 0 1px #000, ',
      '0 0 1px #000 inset',
      5,
      null,
      Array.from({ length: 5 }, () => '0 1px #000').join(', '),
    ]) {
      expect(css(g, bad), String(bad)).toBeUndefined();
    }
  });

  it('fontFamily', () => {
    const g: StyleGrammar = { kind: 'fontFamily' };
    expect(css(g, 'Inter, system-ui, sans-serif')).toBe('Inter, system-ui, sans-serif');
    expect(css(g, 'Segoe UI,  Noto Sans ,monospace')).toBe('Segoe UI, Noto Sans, monospace');
    for (const bad of [
      '',
      'Inter,',
      '1Inter',
      'Inter;',
      'a b c d e f g',
      'initial',
      'Inter, inherit',
      'x'.repeat(41),
      5,
      Array.from({ length: 9 }, () => 'serif').join(', '),
    ]) {
      expect(css(g, bad), String(bad)).toBeUndefined();
    }
  });

  it('transition', () => {
    const g: StyleGrammar = { kind: 'transition' };
    expect(css(g, 'none')).toBe('none');
    expect(css(g, '150ms ease')).toBe('150ms ease');
    expect(css(g, 'opacity 0.2s ease-in-out 50ms, transform 300ms linear')).toBe(
      'opacity 0.2s ease-in-out 50ms, transform 300ms linear',
    );
    for (const bad of [
      'ease',
      'width 1s',
      '6s',
      '1s cubic-bezier(0,0,1,1)',
      '1s ease 1s 1s',
      '1s, ',
      5,
    ]) {
      expect(css(g, bad), String(bad)).toBeUndefined();
    }
  });
});

describe('compileTokens', () => {
  it('emits the layer with sorted custom properties', () => {
    const theme = defineTheme({
      breakpoints: [],
      tokens: {
        space: { 4: '1rem', 0: '0' },
        color: { primary: '#2563EB', 'on-primary': '#fff' },
        fontFamily: { body: 'system-ui, sans-serif' },
        fontSize: { '2xl': '1.5rem' },
      },
    });
    expect(compileTokens(theme)).toMatchInlineSnapshot(`
      "@layer buildr.tokens {
        :root {
          --b-color-on-primary: #fff;
          --b-color-primary: #2563eb;
          --b-space-0: 0;
          --b-space-4: 1rem;
          --b-font-family-body: system-ui, sans-serif;
          --b-font-size-2xl: 1.5rem;
        }
      }"
    `);
  });

  it('emits an empty layer for a theme without tokens', () => {
    expect(compileTokens(defineTheme({ breakpoints: [], tokens: {} }))).toBe(
      '@layer buildr.tokens {\n}',
    );
  });

  it('is deterministic whatever order the keys were written in', () => {
    const forward = defineTheme({
      breakpoints: BP,
      tokens: { color: { a: '#000', b: '#111' }, space: { 1: '1px', 2: '2px' } },
    });
    const reversed = defineTheme({
      breakpoints: BP,
      tokens: { space: { 2: '2px', 1: '1px' }, color: { b: '#111', a: '#000' } },
    });
    expect(compileTokens(reversed)).toBe(compileTokens(forward));
    expect(compileTokens(defaultTheme)).toBe(compileTokens(defaultTheme));
  });

  it('compiles the default theme to safe CSS of every token', () => {
    const css = compileTokens(defaultTheme);
    expect(css.startsWith('@layer buildr.tokens {\n  :root {\n')).toBe(true);
    expect(css).toContain('--b-color-primary: #2563eb;');
    expect(css).toContain('--b-space-4: 1rem;');
    expect(css).toContain('--b-shadow-sm: 0 1px 2px rgb(0 0 0 / 0.08);');
    expect(css).toContain('--b-font-family-body: system-ui, sans-serif;');
    expect(css).toContain('--b-transition-fast: 150ms ease;');
    expect(css).not.toMatch(/!important|url\(|expression|calc\(|\\/);
    // Every declaration is `  --b-*: value;` and braces are only the layer/:root structure.
    const declarations = css.split('\n').filter((line) => line.startsWith('    --b-'));
    const total = Object.values(defaultTheme.tokens).reduce(
      (n, scale) => n + Object.keys(scale).length,
      0,
    );
    expect(declarations).toHaveLength(total);
    for (const line of declarations) expect(line).toMatch(/^ {4}--b-[a-z0-9-]+: [^;{}]+;$/);
  });

  it('names custom properties the way token references compile', () => {
    expect(tokenVariableName('fontFamily', 'body')).toBe('--b-font-family-body');
    expect(tokenVariableName('space', '4')).toBe('--b-space-4');
    const ref = parseStyleValue(
      { kind: 'composite', tokens: ['fontFamily'] },
      '$fontFamily.heading',
    );
    expect(ref.ok && ref.value).toBe(`var(${tokenVariableName('fontFamily', 'heading')})`);
  });

  it('declares the layer order once', () => {
    expect(LAYER_ORDER_CSS).toBe(
      '@layer buildr.reset, buildr.tokens, buildr.components, buildr.nodes;',
    );
  });
});

describe('resolveTokenRef', () => {
  it('resolves a defined token', () => {
    const result = resolveTokenRef(defaultTheme, '$space.4');
    expect(result).toEqual({
      ok: true,
      value: { scale: 'space', name: '4', value: '1rem', cssVar: 'var(--b-space-4)' },
    });
    expect(resolveTokenRef(defaultTheme, '$fontSize.2xl')).toMatchObject({
      ok: true,
      value: { value: '1.5rem', cssVar: 'var(--b-font-size-2xl)' },
    });
  });

  it.each([
    '$space.99',
    '$nope.4',
    '$space',
    'space.4',
    '',
    '$space.4 ',
    '$Space.4',
    '$space.__proto__',
    '$color.constructor',
    5,
    null,
  ])('reports %j as an unknown token', (ref) => {
    const result = resolveTokenRef(defaultTheme, ref as string);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('theme.unknown-token');
  });
});
