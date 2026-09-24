import { describe, expect, it } from 'vitest';
import type { NodeStyles } from '../document/style-types.ts';
import { effectiveStyle, effectiveStyles, hasOverrides } from './effective.ts';
import { defaultTheme } from './theme.ts';

const bps = defaultTheme.breakpoints;

const styles: NodeStyles = {
  base: {
    layout: { display: 'flex', gap: '$space.8' },
    spacing: { margin: { top: '1rem', left: '2rem' } },
  },
  bp: {
    tablet: { layout: { gap: '$space.4' }, spacing: { margin: { top: '0.5rem' } } },
    mobile: { layout: { display: 'block' }, visibility: { hidden: true } },
  },
};

describe('effectiveStyles', () => {
  it('base sees only base values', () => {
    const e = effectiveStyles(styles, 'base', bps);
    expect(e['layout.gap']).toEqual({ value: '$space.8', source: 'base' });
    expect(e['visibility.hidden']).toBeUndefined();
  });

  it('cascades desktop -> tablet -> mobile', () => {
    const tablet = effectiveStyles(styles, 'tablet', bps);
    expect(tablet['layout.gap']).toEqual({ value: '$space.4', source: 'tablet' });
    expect(tablet['layout.display']).toEqual({ value: 'flex', source: 'base' });
    const mobile = effectiveStyles(styles, 'mobile', bps);
    expect(mobile['layout.gap']).toEqual({ value: '$space.4', source: 'tablet' });
    expect(mobile['layout.display']).toEqual({ value: 'block', source: 'mobile' });
    expect(mobile['visibility.hidden']).toEqual({ value: true, source: 'mobile' });
  });

  it('a narrower breakpoint does not leak into a wider one', () => {
    expect(effectiveStyles(styles, 'tablet', bps)['layout.display']?.source).toBe('base');
  });

  it('cascades per side for box properties', () => {
    const e = effectiveStyles(styles, 'mobile', bps);
    expect(e['spacing.margin.top']).toEqual({ value: '0.5rem', source: 'tablet' });
    expect(e['spacing.margin.left']).toEqual({ value: '2rem', source: 'base' });
    expect(e['spacing.margin.right']).toBeUndefined();
  });

  it('reset (removing the key) falls back to the wider layer', () => {
    const reset: NodeStyles = { ...styles, bp: { ...styles.bp, tablet: {} } };
    expect(effectiveStyle(reset, 'tablet', bps, 'layout.gap')).toEqual({
      value: '$space.8',
      source: 'base',
    });
  });

  it('an unknown breakpoint sees only base; malformed styles never throw', () => {
    expect(effectiveStyles(styles, 'huge', bps)['layout.gap']?.source).toBe('base');
    const malformed = [null, 'x', 3, [], { base: 'x', bp: 3 }, { bp: { tablet: null } }];
    for (const bad of malformed) {
      expect(effectiveStyles(bad as never, 'tablet', bps)).toEqual({});
    }
  });

  it('ignores keys the registry does not know', () => {
    const odd = { base: { layout: { nope: 'x' }, bogus: { a: 'b' } } } as unknown as NodeStyles;
    expect(effectiveStyles(odd, 'base', bps)).toEqual({});
  });

  it('effectiveStyle looks up one path', () => {
    expect(effectiveStyle(styles, 'mobile', bps, 'layout.display')?.value).toBe('block');
    expect(effectiveStyle(styles, 'mobile', bps, 'layout.nope')).toBeUndefined();
    expect(effectiveStyle(styles, 'mobile', bps, '__proto__')).toBeUndefined();
  });
});

describe('hasOverrides', () => {
  it('is true only for a layer that sets something', () => {
    expect(hasOverrides(styles, 'base')).toBe(true);
    expect(hasOverrides(styles, 'tablet')).toBe(true);
    expect(hasOverrides({ base: {} }, 'base')).toBe(false);
    expect(hasOverrides({ bp: { tablet: {} } }, 'tablet')).toBe(false);
    expect(hasOverrides(styles, 'huge')).toBe(false);
    expect(hasOverrides(null as never, 'base')).toBe(false);
  });
});
