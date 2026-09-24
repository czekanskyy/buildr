import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_STYLE_VALUE_LENGTH, parseStyleValue, type StyleGrammar } from './grammar.ts';

const css = (grammar: StyleGrammar, input: unknown, inheritable = false) => {
  const result = parseStyleValue(grammar, input, { inheritable });
  return result.ok ? result.value : undefined;
};

const LENGTH: StyleGrammar = {
  kind: 'composite',
  tokens: ['space'],
  keywords: ['auto'],
  length: { units: ['px', 'rem', '%'], negative: true },
  number: { min: 0, max: 10, integer: true },
};
const COLOR: StyleGrammar = { kind: 'color', keywords: ['transparent'] };

describe('composite grammar', () => {
  it.each([
    ['16px', '16px'],
    ['1.5rem', '1.5rem'],
    ['-8px', '-8px'],
    ['50%', '50%'],
    ['007px', '7px'],
    ['0.0px', '0px'],
    ['-0px', '0px'],
    ['0', '0'],
    [0, '0'],
    ['auto', 'auto'],
    ['$space.4', 'var(--b-space-4)'],
    ['$space.2-5', 'var(--b-space-2-5)'],
    [7, '7'],
  ])('accepts %j', (input, expected) => {
    expect(css(LENGTH, input)).toBe(expected);
  });

  it.each([
    '',
    ' 16px',
    '16px ',
    '16 px',
    '16',
    '16pt',
    '1e3px',
    '.5px',
    '1.23456px',
    '--1px',
    '$color.primary',
    '$space',
    '$space.',
    '$space.UP',
    '$nope.4',
    '$space.4 ',
    'AUTO',
    'none',
    '100001px',
    '1px 2px',
    'inherit',
  ])('rejects %j', (input) => {
    expect(css(LENGTH, input)).toBeUndefined();
  });

  it('rejects numbers outside the grammar', () => {
    for (const n of [11, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1e9, 0.00001]) {
      expect(css(LENGTH, n)).toBeUndefined();
    }
    expect(css({ kind: 'composite', keywords: ['a'] }, 1)).toBeUndefined();
  });

  it('rejects non-scalar types', () => {
    for (const input of [null, undefined, true, [], {}, ['16px'], { top: '1px' }]) {
      expect(css(LENGTH, input)).toBeUndefined();
    }
  });

  it('disallows negatives unless the grammar allows them', () => {
    const positive: StyleGrammar = { kind: 'composite', length: { units: ['px'] } };
    expect(css(positive, '-1px')).toBeUndefined();
    expect(css(positive, '1px')).toBe('1px');
  });

  it('only accepts the units the grammar lists', () => {
    expect(css({ kind: 'composite', length: { units: ['fr'] } }, '1fr')).toBe('1fr');
    expect(css({ kind: 'composite', length: { units: ['px'] } }, '1fr')).toBeUndefined();
  });

  it('accepts inherit only for inheritable properties', () => {
    const grammar: StyleGrammar = { kind: 'composite', keywords: ['left'] };
    expect(css(grammar, 'inherit', true)).toBe('inherit');
    expect(css(grammar, 'inherit', false)).toBeUndefined();
    expect(css(grammar, 'initial', true)).toBeUndefined();
  });

  it('explains what was expected', () => {
    const result = parseStyleValue(LENGTH, 'nope');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('style.invalid-value');
      expect(result.error.message).toMatch(/token.*one of auto.*length.*number/);
    }
  });
});

describe('color grammar', () => {
  it.each([
    ['#fff', '#fff'],
    ['#FFFA', '#fffa'],
    ['#1A2b3C', '#1a2b3c'],
    ['#11223344', '#11223344'],
    ['$color.on-primary', 'var(--b-color-on-primary)'],
    ['transparent', 'transparent'],
    ['rgb(255, 0, 10)', 'rgb(255 0 10)'],
    ['rgb(255 0 10)', 'rgb(255 0 10)'],
    ['rgba(255, 0, 10, 0.5)', 'rgb(255 0 10 / 0.5)'],
    ['rgb(255 0 10 / 50%)', 'rgb(255 0 10 / 0.5)'],
    ['rgb(100%, 0%, 50%)', 'rgb(255 0 127.5)'],
    ['hsl(120, 50%, 40%)', 'hsl(120 50% 40%)'],
    ['hsl(120deg 50% 40% / 0.2)', 'hsl(120 50% 40% / 0.2)'],
    ['oklch(0.7 0.1 200)', 'oklch(0.7 0.1 200)'],
    ['oklch(70% 0.1 200deg / 0.5)', 'oklch(0.7 0.1 200 / 0.5)'],
  ])('accepts %s', (input, expected) => {
    expect(css(COLOR, input)).toBe(expected);
  });

  it.each([
    'red',
    '#ff',
    '#fffff',
    '#ggg',
    'fff',
    '$space.4',
    '$color',
    'transparent ',
    'currentColor',
    'rgb(256, 0, 0)',
    'rgb(1 2)',
    'rgb(1, 2, 3, 4, 5)',
    'rgb(1, 2, 3 / 0.5)',
    'rgb(1 2 3 / 2)',
    'rgb(1 2 3 / 0.5 / 0.2)',
    'rgb(a b c)',
    'rgb(-1 0 0)',
    'rgb(1,2,3',
    'rgb((1) 2 3)',
    'hsl(400 50% 50%)',
    'hsl(120 50 50)',
    'hsl(120 150% 50%)',
    'oklch(2 0.1 10)',
    'oklch(0.5 0.9 10)',
    'lab(50 0 0)',
    'color-mix(in srgb, red, blue)',
    'rgb(0 0 0)x',
    'x rgb(0 0 0)',
  ])('rejects %s', (input) => {
    expect(css(COLOR, input)).toBeUndefined();
  });

  it('does not accept a non-color token scale', () => {
    expect(css({ kind: 'color' }, '$space.4')).toBeUndefined();
    expect(css({ kind: 'color' }, 'transparent')).toBeUndefined();
  });
});

describe('gradient grammar', () => {
  const gradient: StyleGrammar = { kind: 'gradient' };

  it.each([
    ['none', 'none'],
    [
      'linear-gradient($color.primary, $color.surface)',
      'linear-gradient(180deg, var(--b-color-primary), var(--b-color-surface))',
    ],
    ['linear-gradient(90deg, #000, #FFF 80%)', 'linear-gradient(90deg, #000, #fff 80%)'],
    [
      'linear-gradient(to right, rgb(0, 0, 0), hsl(10 50% 50%) 10.5%, #fff)',
      'linear-gradient(to right, rgb(0 0 0), hsl(10 50% 50%) 10.5%, #fff)',
    ],
    ['linear-gradient(to top left, #000, #fff)', 'linear-gradient(to top left, #000, #fff)'],
    ['linear-gradient(-45deg, #000, #fff)', 'linear-gradient(-45deg, #000, #fff)'],
  ])('accepts %s', (input, expected) => {
    expect(css(gradient, input)).toBe(expected);
  });

  it.each([
    'linear-gradient(#000)',
    'linear-gradient()',
    'radial-gradient(#000, #fff)',
    'linear-gradient(400deg, #000, #fff)',
    'linear-gradient(to nowhere, #000, #fff)',
    'linear-gradient(#000, red)',
    'linear-gradient(#000, #fff 120%)',
    'linear-gradient(#000, #fff',
    'linear-gradient(#000, #fff))',
    'linear-gradient((#000), #fff)',
    'linear-gradient(90deg, #000, #fff), url(x)',
    'linear-gradient(#000, #fff) x',
    `linear-gradient(${Array.from({ length: 9 }, () => '#000').join(', ')})`,
    'linear-gradient(90deg, $space.4, #fff)',
    'none ',
    'NONE',
  ])('rejects %s', (input) => {
    expect(css(gradient, input)).toBeUndefined();
  });
});

describe('other grammars', () => {
  it('ratio', () => {
    const ratio: StyleGrammar = { kind: 'ratio' };
    expect(css(ratio, '16 / 9')).toBe('16 / 9');
    expect(css(ratio, '16/9')).toBe('16 / 9');
    expect(css(ratio, 1.5)).toBe('1.5');
    expect(css(ratio, 'auto')).toBe('auto');
    for (const bad of ['0 / 1', '1 / 0', '1 / 2 / 3', -1, 0, 101, 'x', '16:9', null]) {
      expect(css(ratio, bad)).toBeUndefined();
    }
  });

  it('gridTrack and gridSpan', () => {
    expect(css({ kind: 'gridTrack' }, 3)).toBe('repeat(3, minmax(0, 1fr))');
    expect(css({ kind: 'gridSpan' }, 2)).toBe('span 2');
    for (const bad of [0, 13, 1.5, '3', -1, null]) {
      expect(css({ kind: 'gridTrack' }, bad)).toBeUndefined();
      expect(css({ kind: 'gridSpan' }, bad)).toBeUndefined();
    }
  });

  it('boolean', () => {
    expect(css({ kind: 'boolean' }, true)).toBe('none');
    expect(css({ kind: 'boolean' }, false)).toBe('');
    for (const bad of ['true', 1, null, undefined]) {
      expect(css({ kind: 'boolean' }, bad)).toBeUndefined();
    }
  });
});

describe('injection attempts', () => {
  const grammars: StyleGrammar[] = [
    LENGTH,
    COLOR,
    { kind: 'gradient' },
    { kind: 'ratio' },
    { kind: 'composite', keywords: ['flex', 'grid'] },
    { kind: 'composite', tokens: ['color', 'space'] },
  ];
  const corpus = [
    'red;}body{',
    'red; background: url(https://evil.test/x)',
    'url(https://evil.test/x)',
    'URL( x )',
    'u\\72l(x)',
    'expression(alert(1))',
    'EXPRESSION (1)',
    'calc(100% - 1px)',
    'CALC(1px)',
    'var(--x)',
    'var (--x)',
    '#fff !important',
    '16px ! important',
    '16px/**/',
    '/* c */ 16px',
    '16px; color: red',
    '16px}',
    '{16px',
    '"16px"',
    "'16px'",
    '`16px`',
    '16px\n',
    '16px\r\ncolor:red',
    '16px\u0000',
    '\u007f16px',
    '@import "x"',
    '<script>alert(1)</script>',
    'javascript:alert(1)',
    'image-set("a.png" 1x)',
    'attr(data-x)',
    'env(safe-area-inset-top)',
    '$space.4;}',
    '$space.4}',
    'a\\',
    'x'.repeat(MAX_STYLE_VALUE_LENGTH + 1),
  ];

  it.each(corpus)('%j is rejected by every grammar', (input) => {
    for (const grammar of grammars) {
      expect(css(grammar, input, true)).toBeUndefined();
    }
  });

  it('never accepts a value that produces forbidden output (property-based)', () => {
    // A generous alphabet of characters likely to form or smuggle CSS.
    const chars = fc.constantFrom(
      ...'abcxyzAZ019 #$.%()-+,/:;{}\\"\'`!@<>\n\t_=~|^*&?[]'.split(''),
    );
    const words = fc.constantFrom(
      'url',
      'var',
      'calc',
      'expression',
      'rgb',
      'hsl',
      'oklch',
      'linear-gradient',
      'to',
      'right',
      'px',
      'rem',
      '$space',
      '$color',
      '.4',
      'auto',
      'none',
      'inherit',
      'deg',
    );
    const input = fc
      .array(fc.oneof(chars, words), { maxLength: 24 })
      .map((parts) => parts.join(''));
    fc.assert(
      fc.property(input, fc.boolean(), (value, inheritable) => {
        for (const grammar of grammars) {
          const out = css(grammar, value, inheritable);
          if (out === undefined) continue;
          expect(out).not.toMatch(/[;{}\\"'`@<>\n\r\t]/);
          // Token names may spell any word (`$color.url`); only what surrounds them counts.
          const outside = out.replace(/var\(--b-[a-z-]+-[a-z0-9-]+\)/g, '');
          expect(outside).not.toMatch(/\/\*|\*\/|!|url\s*\(|expression|calc\s*\(|javascript/i);
          // The only `var()` allowed is the one a token compiles to.
          for (const match of out.matchAll(/var\(([^)]*)\)/g)) {
            expect(match[1]).toMatch(/^--b-[a-z-]+-[a-z0-9-]+$/);
          }
        }
      }),
      { numRuns: 5000 },
    );
  });

  it('treats a token named like a forbidden word as a plain token (regression)', () => {
    expect(css({ kind: 'color' }, '$color.expression')).toBe('var(--b-color-expression)');
    expect(css({ kind: 'color' }, '$color.url')).toBe('var(--b-color-url)');
  });

  it('never throws whatever the input', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        for (const grammar of grammars) expect(() => parseStyleValue(grammar, value)).not.toThrow();
      }),
      { numRuns: 500 },
    );
  });
});
