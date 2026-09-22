import { describe, expect, it } from 'vitest';
import { p } from '../schema/p.ts';
import type { ComponentMeta } from './meta.ts';
import { validateComponentMeta } from './validate-meta.ts';

/** A minimal, otherwise-valid `ComponentMeta` — each case overrides just what it's testing. */
function meta(overrides: Partial<ComponentMeta> = {}): ComponentMeta {
  return {
    type: 'buildr/heading',
    version: 1,
    label: 'Heading',
    category: 'content',
    props: { text: p.text({ default: 'Heading' }) },
    contentCategories: ['flow', 'heading'],
    styles: { groups: ['typography'] },
    runtime: 'shared',
    ...overrides,
  };
}

describe('validateComponentMeta', () => {
  const cases: { name: string; meta: ComponentMeta; valid: boolean; code?: string }[] = [
    {
      name: 'a minimal leaf component',
      meta: meta(),
      valid: true,
    },
    {
      name: 'a component with a well-formed slot',
      meta: meta({
        slots: { default: { min: 0, max: 10, allow: ['#flow'], deny: ['buildr/section'] } },
      }),
      valid: true,
    },
    {
      name: 'a component whose defaults.slots references a declared slot',
      meta: meta({
        slots: { actions: {} },
        defaults: { slots: { actions: [{ type: 'buildr/button' }] } },
      }),
      valid: true,
    },
    {
      name: 'a component whose editor.emptySlotText references a declared slot',
      meta: meta({
        slots: { default: {} },
        editor: { emptySlotText: { default: 'Drop content here' } },
      }),
      valid: true,
    },
    {
      name: 'a component with valid parents rules mixing type and category matchers',
      meta: meta({
        parents: {
          allow: ['#flow'],
          deny: ['buildr/heading'],
          requireAncestor: ['#form-control'],
        },
      }),
      valid: true,
    },
    {
      name: 'a component with a custom (non-enum) category string',
      meta: meta({ category: 'acme-custom' }),
      valid: true,
    },
    {
      name: 'a type with no namespace',
      meta: meta({ type: 'heading' }),
      valid: false,
      code: 'component.invalid-type',
    },
    {
      name: 'a type with uppercase characters',
      meta: meta({ type: 'Buildr/Heading' }),
      valid: false,
      code: 'component.invalid-type',
    },
    {
      name: 'a zero version',
      meta: meta({ version: 0 }),
      valid: false,
      code: 'component.invalid-version',
    },
    {
      name: 'a non-integer version',
      meta: meta({ version: 1.5 }),
      valid: false,
      code: 'component.invalid-version',
    },
    {
      name: "a prop default that fails its own kind's validator",
      meta: meta({ props: { count: p.number({ min: 1, max: 12 }) } }),
      valid: false,
      code: 'component.invalid-prop-default',
    },
    {
      name: 'a slot name starting with an uppercase letter',
      meta: meta({ slots: { Default: {} } }),
      valid: false,
      code: 'component.invalid-slot-name',
    },
    {
      name: 'a slot name containing a hyphen',
      meta: meta({ slots: { 'my-slot': {} } }),
      valid: false,
      code: 'component.invalid-slot-name',
    },
    {
      name: 'a slot with a negative min',
      meta: meta({ slots: { default: { min: -1 } } }),
      valid: false,
      code: 'component.invalid-slot-range',
    },
    {
      name: 'a slot whose min exceeds its max',
      meta: meta({ slots: { default: { min: 5, max: 2 } } }),
      valid: false,
      code: 'component.invalid-slot-range',
    },
    {
      name: 'defaults.slots referencing an undeclared slot',
      meta: meta({ defaults: { slots: { actions: [{ type: 'buildr/button' }] } } }),
      valid: false,
      code: 'component.unknown-slot',
    },
    {
      name: 'editor.emptySlotText referencing an undeclared slot',
      meta: meta({ editor: { emptySlotText: { default: 'Empty' } } }),
      valid: false,
      code: 'component.unknown-slot',
    },
    {
      name: 'an empty contentCategories array',
      meta: meta({ contentCategories: [] }),
      valid: false,
      code: 'component.empty-content-categories',
    },
    {
      name: 'an unknown content category',
      // @ts-expect-error deliberately invalid at the type level too
      meta: meta({ contentCategories: ['bogus'] }),
      valid: false,
      code: 'component.invalid-content-category',
    },
    {
      name: 'an unknown category matcher in parents.allow',
      meta: meta({ parents: { allow: ['#bogus'] } }),
      valid: false,
      code: 'component.invalid-matcher',
    },
    {
      name: 'a malformed type matcher in a slot allow list',
      meta: meta({ slots: { default: { allow: ['NotAType'] } } }),
      valid: false,
      code: 'component.invalid-matcher',
    },
  ];

  for (const { name, meta: componentMeta, valid, code } of cases) {
    it(`${valid ? 'accepts' : 'rejects'} ${name}`, () => {
      const diagnostics = validateComponentMeta(componentMeta);
      if (valid) {
        expect(diagnostics).toEqual([]);
      } else {
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics.map((d) => d.code)).toContain(code);
        for (const diagnostic of diagnostics) {
          expect(diagnostic.severity).toBe('error');
          expect(diagnostic.message.length).toBeGreaterThan(0);
        }
      }
    });
  }

  it('reports every violation, not just the first', () => {
    const diagnostics = validateComponentMeta(
      meta({ type: 'bad', version: 0, contentCategories: [] }),
    );
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain('component.invalid-type');
    expect(codes).toContain('component.invalid-version');
    expect(codes).toContain('component.empty-content-categories');
  });
});
