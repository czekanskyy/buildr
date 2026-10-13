import { describe, expect, it } from 'vitest';
import type { BuilderFragment } from '../document/fragment.ts';
import type { ComponentMeta } from './meta.ts';
import { createRegistryMeta } from './registry.ts';
import { registryVersions, withRegistryVersions } from './versions.ts';

function component(type: string, version: number): ComponentMeta {
  return {
    type,
    version,
    label: type,
    category: 'content',
    props: {},
    contentCategories: ['flow'],
    styles: { groups: [] },
    runtime: 'shared',
  };
}

const registry = createRegistryMeta({
  components: [component('acme/box', 2), component('acme/text', 1)],
});

describe('registryVersions', () => {
  it('maps every registered type to its version', () => {
    expect(registryVersions(registry)).toEqual({ 'acme/box': 2, 'acme/text': 1 });
  });
});

describe('withRegistryVersions', () => {
  it('pins known types to the registry and keeps unknown ones', () => {
    const fragment: BuilderFragment = {
      format: 'buildr/fragment',
      schemaVersion: 1,
      components: { 'acme/box': 1, 'acme/other': 3 },
      roots: [],
      nodes: {},
    };
    expect(withRegistryVersions(fragment, registry).components).toEqual({
      'acme/box': 2,
      'acme/other': 3,
    });
  });
});
