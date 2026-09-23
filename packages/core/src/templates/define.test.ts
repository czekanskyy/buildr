import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../registry/registry.ts';
import { defineTemplate, validateTemplateDefinition } from './define.ts';

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

describe('defineTemplate', () => {
  it('returns a valid definition unchanged', () => {
    const input = template();
    expect(defineTemplate(input)).toBe(input);
  });

  it('accepts variants and a structural lock', () => {
    const input = template({
      lock: 'structure',
      variants: { centered: { type: 'buildr/section', name: 'Centered' } },
    });
    expect(defineTemplate(input)).toBe(input);
  });

  it('throws for a non-integer or zero version', () => {
    expect(() => defineTemplate(template({ version: 0 }))).toThrow(/template.invalid-version/);
    expect(() => defineTemplate(template({ version: 1.5 }))).toThrow(/template.invalid-version/);
  });

  it('throws for a duplicate anchor within the tree', () => {
    const input = template({
      tree: {
        type: 'buildr/section',
        children: [
          { type: 'buildr/heading', anchor: 'hero-title' },
          { type: 'buildr/text', anchor: 'hero-title' },
        ],
      },
    });
    expect(() => defineTemplate(input)).toThrow(/template.duplicate-anchor/);
  });

  it('throws for a duplicate region within a variant tree, independent of the main tree', () => {
    const input = template({
      variants: {
        withDuplicateRegion: {
          type: 'buildr/section',
          children: [
            { type: 'buildr/stack', region: 'actions' },
            { type: 'buildr/stack', region: 'actions' },
          ],
        },
      },
    });
    expect(() => defineTemplate(input)).toThrow(/template.duplicate-region/);
  });

  it('does not flag the same anchor reused across the main tree and a separate variant', () => {
    const input = template({
      tree: { type: 'buildr/section', anchor: 'hero' },
      variants: { centered: { type: 'buildr/section', anchor: 'hero' } },
    });
    expect(validateTemplateDefinition(input)).toEqual([]);
  });
});
