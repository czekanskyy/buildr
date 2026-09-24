import { describe, expect, it } from 'vitest';
import { nodeStylesSchema, styleDeclSchema } from './schema.ts';

const ok = (styles: unknown) => nodeStylesSchema.safeParse(styles).success;
const issue = (styles: unknown) => {
  const result = nodeStylesSchema.safeParse(styles);
  return result.success ? undefined : result.error.issues[0];
};

describe('nodeStylesSchema', () => {
  it('accepts an empty object and a realistic set', () => {
    expect(ok({})).toBe(true);
    expect(
      ok({
        base: {
          layout: { display: 'flex', direction: 'column', gap: '$space.4', inset: { top: '0' } },
          size: { maxWidth: '$container.lg', aspectRatio: '16 / 9' },
          spacing: { padding: { top: '$space.8', bottom: '$space.8' }, margin: { left: 'auto' } },
          typography: { fontSize: '$fontSize.lg', fontWeight: 600, color: 'inherit' },
          background: { color: '#fff', gradient: 'none' },
          border: { width: { top: '1px' }, style: 'solid', radius: { topLeft: '$radius.md' } },
          effects: { opacity: 0.9, shadow: '$shadow.sm' },
          visibility: { hidden: false },
        },
        bp: { tablet: { layout: { direction: 'row' } }, mobile: { visibility: { hidden: true } } },
        state: {
          hover: { background: { color: '$color.primary' }, effects: { cursor: 'pointer' } },
        },
      }),
    ).toBe(true);
  });

  it('rejects unknown groups, properties, sides and keys', () => {
    expect(ok({ base: { nope: {} } })).toBe(false);
    expect(ok({ base: { layout: { flexBasis: '1px' } } })).toBe(false);
    expect(ok({ base: { spacing: { margin: { middle: '1px' } } } })).toBe(false);
    expect(ok({ base: { border: { radius: { top: '1px' } } } })).toBe(false);
    expect(ok({ cq: [] })).toBe(false);
    expect(ok(JSON.parse('{"base":{"__proto__":{"layout":{}}}}'))).toBe(false);
    expect(ok(JSON.parse('{"base":{"layout":{"__proto__":{"x":1}}}}'))).toBe(false);
  });

  it('runs every value through its grammar and points at the property', () => {
    const first = issue({ base: { spacing: { padding: { top: 'red;}body{' } } } });
    expect(first?.path).toEqual(['base', 'spacing', 'padding', 'top']);
    expect(first?.message).toMatch(/never allowed|expected/);
    expect(ok({ base: { layout: { display: 'url(x)' } } })).toBe(false);
    expect(ok({ base: { spacing: { padding: '1px' } } })).toBe(false);
    expect(ok({ base: { layout: { display: 'inherit' } } })).toBe(false);
    expect(ok({ base: { typography: { textAlign: 'inherit' } } })).toBe(true);
  });

  it('validates breakpoint ids and their number', () => {
    expect(ok({ bp: { 'wide-2': {} } })).toBe(true);
    for (const id of ['Tablet', '1x', 'a b', '', 'a'.repeat(33), '_x', 'constructor!']) {
      expect(ok({ bp: { [id]: {} } }), id).toBe(false);
    }
    // A `__proto__` key is dropped rather than stored, so it can never reach an object prototype.
    const dropped = nodeStylesSchema.safeParse(JSON.parse('{"bp":{"__proto__":{}}}'));
    expect(dropped.success && Object.keys(dropped.data.bp ?? {})).toEqual([]);
    const nine = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`bp${i}`, {}]));
    expect(ok({ bp: nine })).toBe(false);
    expect(ok({ bp: Object.fromEntries(Object.entries(nine).slice(0, 8)) })).toBe(true);
  });

  it('restricts pseudo-states to visual properties and known states', () => {
    expect(ok({ state: { hover: { layout: { display: 'none' } } } })).toBe(false);
    expect(ok({ state: { hover: { size: { width: '1px' } } } })).toBe(false);
    expect(ok({ state: { hover: { typography: { fontSize: '$fontSize.lg' } } } })).toBe(false);
    expect(ok({ state: { hover: { typography: { color: '#fff' } } } })).toBe(true);
    expect(ok({ state: { focus: {} } })).toBe(false);
    expect(ok({ state: { 'focus-visible': { border: { color: '$color.focus' } } } })).toBe(true);
  });

  it('rejects non-object input', () => {
    for (const bad of [null, 'x', 1, [], { base: null }, { base: [] }, { bp: [] }]) {
      expect(ok(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('exposes the declaration schema on its own', () => {
    expect(styleDeclSchema.safeParse({ layout: { display: 'grid', columns: 3 } }).success).toBe(
      true,
    );
    expect(styleDeclSchema.safeParse({ layout: { columns: 13 } }).success).toBe(false);
  });
});
