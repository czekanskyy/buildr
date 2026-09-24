import { readdirSync, readFileSync } from 'node:fs';
import {
  type ComponentType,
  defaultTheme as coreDefaultTheme,
  type TreeNode,
  toManifest,
} from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { galleryEntries } from './gallery.ts';
import { createDefaultRegistry, defaultComponents, defaultTemplates } from './registry.ts';
import { defaultTheme } from './theme.ts';

const registry = createDefaultRegistry();

/** The types of every `src/<name>/definition.ts` on disk: what the library ships. */
const shippedTypes = readdirSync(new URL('./', import.meta.url)).flatMap((name) => {
  try {
    const source = readFileSync(new URL(`./${name}/definition.ts`, import.meta.url), 'utf8');
    return [/type: '(buildr\/[a-z-]+)'/.exec(source)?.[1] ?? ''];
  } catch {
    return []; // a folder that is not a component (icons, field, styles, templates)
  }
});

const typesIn = (node: TreeNode): string[] => [
  node.type,
  ...Object.values(node.slots ?? { default: node.children ?? [] }).flatMap((children) =>
    children.flatMap(typesIn),
  ),
];

describe('the default registry', () => {
  it('has every component the library ships, once', () => {
    const types = defaultComponents.map((c) => c.meta.type);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual([...shippedTypes].sort());
    expect(types).toHaveLength(26);
  });

  it('has the fourteen templates: seven marketing, seven blog and product', () => {
    expect(defaultTemplates.map((t) => t.id)).toEqual([
      'buildr/hero',
      'buildr/feature-grid',
      'buildr/cta',
      'buildr/testimonial',
      'buildr/pricing',
      'buildr/faq',
      'buildr/contact',
      'buildr/post-header',
      'buildr/post-content',
      'buildr/author-box',
      'buildr/post-card',
      'buildr/blog-listing',
      'buildr/product-hero',
      'buildr/product-details',
    ]);
  });

  it('is built fresh each time and shares no state', () => {
    const a = createDefaultRegistry();
    const b = createDefaultRegistry();
    expect(a).not.toBe(b);
    const extended = a.extend({ components: [] });
    expect(extended.list()).toHaveLength(26);
    expect(a.list()).toHaveLength(26);
    expect(b.meta.listTemplates()).toHaveLength(14);
  });

  it('cannot be given a component twice', () => {
    expect(() => registry.extend({ components: [defaultComponents[0] as never] })).toThrow();
  });

  it('has a manifest under 60 KB', () => {
    const manifest = toManifest(registry.meta);
    const size = new TextEncoder().encode(JSON.stringify(manifest)).length;
    expect(Object.keys(manifest.components)).toHaveLength(26);
    expect(Object.keys(manifest.templates)).toHaveLength(14);
    expect(size).toBeLessThan(60 * 1024);
  });

  it('has a manifest that is the same every time, and is plain data', () => {
    const one = toManifest(createDefaultRegistry().meta);
    const two = toManifest(createDefaultRegistry().meta);
    expect(one.hash).toBe(two.hash);
    expect(JSON.parse(JSON.stringify(one))).toEqual(one);
  });

  it('uses the core default theme, which has every token the templates use', () => {
    expect(defaultTheme).toBe(coreDefaultTheme);
  });
});

describe('the gallery', () => {
  it('shows every component at least once, and every template and variant', () => {
    const shown = new Set(galleryEntries.filter((e) => e.group === 'component').map((e) => e.of));
    for (const component of defaultComponents) {
      expect(shown.has(component.meta.type), component.meta.type).toBe(true);
    }
    const templates = new Set(
      galleryEntries.filter((e) => e.group === 'template').map((e) => e.of),
    );
    for (const template of defaultTemplates) {
      expect(templates.has(template.id), template.id).toBe(true);
    }
    const variants = defaultTemplates.reduce((n, t) => n + Object.keys(t.variants ?? {}).length, 0);
    expect(galleryEntries.filter((e) => e.group === 'template')).toHaveLength(14 + variants);
  });

  it('has unique ids, and only components of the default registry', () => {
    const ids = galleryEntries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of galleryEntries) {
      for (const type of typesIn(entry.tree)) {
        expect(registry.has(type as ComponentType), `${entry.id}: ${type}`).toBe(true);
      }
    }
  });
});
