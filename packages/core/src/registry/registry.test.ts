import { describe, expect, it } from 'vitest';
import { p } from '../schema/p.ts';
import type { ComponentMeta } from './meta.ts';
import { createRegistryMeta, type TemplateDefinition } from './registry.ts';

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

function template(overrides: Partial<TemplateDefinition> = {}): TemplateDefinition {
  return {
    id: 'buildr/hero',
    version: 1,
    label: 'Hero',
    category: 'sections',
    lock: 'none',
    tree: { type: 'buildr/section' },
    ...overrides,
  };
}

describe('createRegistryMeta', () => {
  it('exposes components via get/has/list/byCategory', () => {
    const heading = meta();
    const button = meta({
      type: 'buildr/button',
      label: 'Button',
      category: 'ui',
      contentCategories: ['flow', 'phrasing', 'interactive'],
    });
    const registry = createRegistryMeta({ components: [heading, button] });

    expect(registry.get('buildr/heading')).toBe(heading);
    expect(registry.get('buildr/missing')).toBeUndefined();
    expect(registry.has('buildr/button')).toBe(true);
    expect(registry.has('buildr/missing')).toBe(false);
    expect(registry.list()).toEqual([heading, button]);
    expect(registry.byCategory('ui')).toEqual([button]);
    expect(registry.byCategory('forms')).toEqual([]);
  });

  it('exposes templates via getTemplate/hasTemplate/listTemplates', () => {
    const hero = template();
    const registry = createRegistryMeta({ components: [meta()], templates: [hero] });

    expect(registry.getTemplate('buildr/hero')).toBe(hero);
    expect(registry.getTemplate('buildr/missing')).toBeUndefined();
    expect(registry.hasTemplate('buildr/hero')).toBe(true);
    expect(registry.listTemplates()).toEqual([hero]);
  });

  it('defaults to no templates', () => {
    const registry = createRegistryMeta({ components: [meta()] });
    expect(registry.listTemplates()).toEqual([]);
  });

  it('rejects a duplicate component type', () => {
    expect(() => createRegistryMeta({ components: [meta(), meta()] })).toThrow(
      /registered more than once/,
    );
  });

  it('rejects a duplicate template id', () => {
    expect(() =>
      createRegistryMeta({ components: [meta()], templates: [template(), template()] }),
    ).toThrow(/registered more than once/);
  });

  it('rejects a component whose meta fails validateComponentMeta', () => {
    expect(() => createRegistryMeta({ components: [meta({ contentCategories: [] })] })).toThrow(
      /component.empty-content-categories/,
    );
  });

  describe('extend', () => {
    it('returns a new registry with the additional components and templates', () => {
      const base = createRegistryMeta({ components: [meta()] });
      const button = meta({ type: 'buildr/button', category: 'ui' });
      const hero = template();

      const extended = base.extend({ components: [button], templates: [hero] });

      expect(base.has('buildr/button')).toBe(false);
      expect(extended.has('buildr/heading')).toBe(true);
      expect(extended.has('buildr/button')).toBe(true);
      expect(extended.getTemplate('buildr/hero')).toEqual(hero);
    });

    it('rejects a type that collides with the base registry', () => {
      const base = createRegistryMeta({ components: [meta()] });
      expect(() => base.extend({ components: [meta()] })).toThrow(/registered more than once/);
    });

    it('does not mutate the base registry', () => {
      const base = createRegistryMeta({ components: [meta()] });
      base.extend({ components: [meta({ type: 'buildr/button', category: 'ui' })] });
      expect(base.list()).toHaveLength(1);
    });
  });
});
