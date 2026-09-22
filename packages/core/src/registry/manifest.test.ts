import { describe, expect, it } from 'vitest';
import { p } from '../schema/p.ts';
import { fromManifest, manifestHash, toManifest } from './manifest.ts';
import type { ComponentMeta } from './meta.ts';
import { createRegistryMeta, type TemplateDefinition } from './registry.ts';

function meta(overrides: Partial<ComponentMeta> = {}): ComponentMeta {
  return {
    type: 'buildr/heading',
    version: 1,
    label: 'Heading',
    category: 'content',
    props: {
      text: p.text({ default: 'Heading', bindable: true }),
      level: p.select({ options: [1, 2, 3], default: 2 }),
      items: p.list(p.object({ label: p.text() }), { max: 5 }),
    },
    contentCategories: ['flow', 'heading'],
    slots: { default: { allow: ['#phrasing'], min: 0, max: 10 } },
    parents: { deny: ['buildr/heading'] },
    a11y: { element: 'h1-h6', rules: ['heading-order'] },
    editor: { inlineProp: 'text' },
    styles: { groups: ['typography', 'spacing'] },
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
    lock: 'structure',
    tree: {
      type: 'buildr/section',
      children: [{ type: 'buildr/heading', props: { text: { kind: 'static', value: 'Hi' } } }],
    },
    variants: { compact: { type: 'buildr/section' } },
    ...overrides,
  };
}

describe('toManifest', () => {
  it('projects the registry into components and templates records, keyed by type/id', () => {
    const registry = createRegistryMeta({ components: [meta()], templates: [template()] });
    const manifest = toManifest(registry);

    expect(manifest.components).toEqual({ 'buildr/heading': meta() });
    expect(manifest.templates).toEqual({ 'buildr/hero': template() });
    expect(typeof manifest.hash).toBe('string');
    expect(manifest.hash.length).toBeGreaterThan(0);
  });

  it('carries no functions (a JSON round-trip is a no-op)', () => {
    const registry = createRegistryMeta({ components: [meta()], templates: [template()] });
    const manifest = toManifest(registry);
    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
  });
});

describe('manifestHash', () => {
  it('is deterministic', () => {
    const registryA = createRegistryMeta({ components: [meta()], templates: [template()] });
    const registryB = createRegistryMeta({ components: [meta()], templates: [template()] });
    expect(manifestHash(registryA)).toBe(manifestHash(registryB));
  });

  it('is independent of registration order', () => {
    const button = meta({ type: 'buildr/button', category: 'ui', slots: undefined });
    const registryA = createRegistryMeta({ components: [meta(), button] });
    const registryB = createRegistryMeta({ components: [button, meta()] });
    expect(manifestHash(registryA)).toBe(manifestHash(registryB));
  });

  it('changes when a component changes', () => {
    const registryA = createRegistryMeta({ components: [meta()] });
    const registryB = createRegistryMeta({ components: [meta({ label: 'Different label' })] });
    expect(manifestHash(registryA)).not.toBe(manifestHash(registryB));
  });

  it('changes when a template changes', () => {
    const registryA = createRegistryMeta({ components: [meta()], templates: [template()] });
    const registryB = createRegistryMeta({
      components: [meta()],
      templates: [template({ label: 'Different label' })],
    });
    expect(manifestHash(registryA)).not.toBe(manifestHash(registryB));
  });
});

describe('fromManifest', () => {
  it('round-trips a manifest produced by toManifest', () => {
    const registry = createRegistryMeta({ components: [meta()], templates: [template()] });
    const manifest = toManifest(registry);

    const result = fromManifest(JSON.parse(JSON.stringify(manifest)));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(manifest);
  });

  it('rejects a non-object', () => {
    const result = fromManifest('not a manifest');
    expect(result.ok).toBe(false);
  });

  it('rejects a manifest missing a required field', () => {
    const registry = createRegistryMeta({ components: [meta()] });
    const manifest = toManifest(registry);
    const { hash: _hash, ...withoutHash } = manifest;

    const result = fromManifest(withoutHash);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it('rejects a component whose prop kind is unknown', () => {
    const registry = createRegistryMeta({ components: [meta()] });
    const manifest = toManifest(registry);
    const tampered = {
      ...manifest,
      components: {
        'buildr/heading': {
          ...manifest.components['buildr/heading'],
          props: { text: { kind: 'bogus', default: '' } },
        },
      },
    };

    const result = fromManifest(tampered);

    expect(result.ok).toBe(false);
  });

  it('rejects an unknown top-level field (strict shape)', () => {
    const registry = createRegistryMeta({ components: [meta()] });
    const manifest = toManifest(registry);

    const result = fromManifest({ ...manifest, extra: true });

    expect(result.ok).toBe(false);
  });
});
