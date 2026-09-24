import { describe, expect, it } from 'vitest';
import { parseStyleValue } from './grammar.ts';
import {
  BOX_SIDES,
  CORNERS,
  getStyleProperty,
  propertiesOfGroup,
  STYLE_GROUPS,
  stylePropertyRegistry,
} from './properties.ts';

/**
 * Every property in docs/styles.md#model, with a valid sample and the CSS it must produce. This
 * table is the "every property has a registry entry and a test" guarantee: the registry must have
 * exactly these keys.
 */
const SAMPLES: Record<string, [input: unknown, css: string]> = {
  'layout.display': ['flex', 'flex'],
  'layout.direction': ['column', 'column'],
  'layout.wrap': ['wrap', 'wrap'],
  'layout.justify': ['space-between', 'space-between'],
  'layout.align': ['center', 'center'],
  'layout.alignSelf': ['auto', 'auto'],
  'layout.gap': ['$space.4', 'var(--b-space-4)'],
  'layout.rowGap': ['1.5rem', '1.5rem'],
  'layout.columnGap': [0, '0'],
  'layout.columns': [3, 'repeat(3, minmax(0, 1fr))'],
  'layout.rows': [2, 'repeat(2, minmax(0, 1fr))'],
  'layout.columnSpan': [2, 'span 2'],
  'layout.order': [-1, '-1'],
  'layout.position': ['sticky', 'sticky'],
  'layout.inset': ['-10px', '-10px'],
  'layout.zIndex': [10, '10'],
  'layout.overflow': ['hidden', 'hidden'],
  'size.width': ['$container.lg', 'var(--b-container-lg)'],
  'size.minWidth': ['50%', '50%'],
  'size.maxWidth': ['none', 'none'],
  'size.height': ['100vh', '100vh'],
  'size.minHeight': ['10svh', '10svh'],
  'size.maxHeight': ['$container.sm', 'var(--b-container-sm)'],
  'size.aspectRatio': ['16 / 9', '16 / 9'],
  'spacing.margin': ['auto', 'auto'],
  'spacing.padding': ['$space.2', 'var(--b-space-2)'],
  'typography.fontFamily': ['$fontFamily.heading', 'var(--b-font-family-heading)'],
  'typography.fontSize': ['$fontSize.2xl', 'var(--b-font-size-2xl)'],
  'typography.fontWeight': [700, '700'],
  'typography.lineHeight': [1.5, '1.5'],
  'typography.letterSpacing': ['-0.02em', '-0.02em'],
  'typography.textAlign': ['center', 'center'],
  'typography.textTransform': ['uppercase', 'uppercase'],
  'typography.fontStyle': ['italic', 'italic'],
  'typography.textDecoration': ['underline', 'underline'],
  'typography.color': ['$color.primary', 'var(--b-color-primary)'],
  'background.color': ['#FFF', '#fff'],
  'background.gradient': [
    'linear-gradient(90deg, $color.primary, #000 80%)',
    'linear-gradient(90deg, var(--b-color-primary), #000 80%)',
  ],
  'background.imagePosition': ['top left', 'top left'],
  'background.imageSize': ['cover', 'cover'],
  'border.width': ['1px', '1px'],
  'border.style': ['solid', 'solid'],
  'border.color': ['rgb(0, 0, 0)', 'rgb(0 0 0)'],
  'border.radius': ['$radius.md', 'var(--b-radius-md)'],
  'effects.opacity': [0.5, '0.5'],
  'effects.shadow': ['$shadow.md', 'var(--b-shadow-md)'],
  'effects.transition': ['$transition.fast', 'var(--b-transition-fast)'],
  'effects.cursor': ['pointer', 'pointer'],
  'visibility.hidden': [true, 'none'],
};

// Properties whose value shape is not `value` — the sample is applied to every side/corner.
const BOX = new Set(['layout.inset', 'spacing.margin', 'spacing.padding', 'border.width']);
const CORNER = new Set(['border.radius']);

// `inherit` is accepted for exactly these (docs/styles.md#css-strategy).
const INHERITABLE = [
  'typography.fontFamily',
  'typography.fontSize',
  'typography.fontWeight',
  'typography.lineHeight',
  'typography.letterSpacing',
  'typography.textAlign',
  'typography.textTransform',
  'typography.fontStyle',
  'typography.color',
  'effects.cursor',
];

// Visual properties allowed in a pseudo-state.
const STATE_GROUPS = new Set(['background', 'border', 'effects']);

describe('style property registry', () => {
  it('has exactly the properties of docs/styles.md', () => {
    expect(Object.keys(stylePropertyRegistry).sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  it('files each property under a known group with a consistent key', () => {
    for (const [key, def] of Object.entries(stylePropertyRegistry)) {
      expect(STYLE_GROUPS).toContain(def.group);
      expect(key).toBe(`${def.group}.${def.name}`);
      expect(def.cssProperty).toMatch(/^[a-z-]+$/);
    }
    for (const group of STYLE_GROUPS) expect(propertiesOfGroup(group).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(SAMPLES))('%s accepts its sample', (key, [input, expected]) => {
    const def = stylePropertyRegistry[key];
    expect(def).toBeDefined();
    if (def === undefined) return;
    const result = parseStyleValue(def.grammar, input, { inheritable: def.inheritable });
    expect(result.ok && result.value).toBe(expected);
  });

  it.each(Object.keys(SAMPLES))('%s rejects injection and foreign types', (key) => {
    const def = stylePropertyRegistry[key];
    if (def === undefined) return;
    for (const bad of [
      'red;}body{',
      'url(https://x.test)',
      'calc(1px + 1px)',
      {},
      [],
      null,
      'no such value',
    ]) {
      expect(parseStyleValue(def.grammar, bad).ok, `${key} ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it('describes box and corner properties with a longhand per side', () => {
    for (const key of BOX) {
      const def = stylePropertyRegistry[key];
      expect(def?.shape).toBe('box');
      expect(Object.keys(def?.sides ?? {}).sort()).toEqual([...BOX_SIDES].sort());
    }
    for (const key of CORNER) {
      const def = stylePropertyRegistry[key];
      expect(def?.shape).toBe('corners');
      expect(Object.keys(def?.sides ?? {}).sort()).toEqual([...CORNERS].sort());
    }
    for (const [key, def] of Object.entries(stylePropertyRegistry)) {
      if (!BOX.has(key) && !CORNER.has(key)) expect(def.shape).toBe('value');
    }
    expect(stylePropertyRegistry['spacing.margin']?.sides?.['top']).toBe('margin-top');
    expect(stylePropertyRegistry['border.width']?.sides?.['left']).toBe('border-left-width');
    expect(stylePropertyRegistry['layout.inset']?.sides?.['top']).toBe('top');
  });

  it('marks exactly the naturally inherited properties inheritable', () => {
    const marked = Object.entries(stylePropertyRegistry)
      .filter(([, def]) => def.inheritable)
      .map(([key]) => key);
    expect(marked.sort()).toEqual([...INHERITABLE].sort());
    for (const key of INHERITABLE) {
      const def = stylePropertyRegistry[key];
      expect(
        parseStyleValue(def?.grammar ?? { kind: 'boolean' }, 'inherit', { inheritable: true }),
      ).toEqual({ ok: true, value: 'inherit' });
    }
    // `inherit` never passes for a property that is not inheritable.
    const display = stylePropertyRegistry['layout.display'];
    expect(
      parseStyleValue(display?.grammar ?? { kind: 'boolean' }, 'inherit', { inheritable: false })
        .ok,
    ).toBe(false);
  });

  it('allows pseudo-states only on visual properties', () => {
    for (const def of Object.values(stylePropertyRegistry)) {
      const visual =
        STATE_GROUPS.has(def.group) ||
        def.name === 'color' ||
        def.name === 'textDecoration' ||
        def.name === 'cursor';
      expect(def.allowInStates, `${def.group}.${def.name}`).toBe(visual);
    }
  });

  it('lists the token scales a property accepts', () => {
    expect(stylePropertyRegistry['spacing.padding']?.tokenScale).toEqual(['space']);
    expect(stylePropertyRegistry['typography.color']?.tokenScale).toEqual(['color']);
    expect(stylePropertyRegistry['layout.display']?.tokenScale).toBeUndefined();
  });

  it('looks up by group and name without reaching prototypes', () => {
    expect(getStyleProperty('layout', 'display')?.cssProperty).toBe('display');
    expect(getStyleProperty('layout', 'nope')).toBeUndefined();
    expect(getStyleProperty('__proto__', 'x')).toBeUndefined();
    expect(getStyleProperty('constructor', 'name')).toBeUndefined();
    expect(Object.isFrozen(stylePropertyRegistry)).toBe(true);
  });
});
