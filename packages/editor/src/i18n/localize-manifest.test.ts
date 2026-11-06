import type { ComponentMeta, RegistryManifest } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { labelCatalog, localizeManifest } from './localize-manifest.ts';

const heading = {
  type: 'buildr/heading',
  version: 1,
  label: 'Heading',
  category: 'content',
  props: {
    text: { kind: 'text', label: 'Text', default: '', localizable: true, accepts: [] },
    level: {
      kind: 'select',
      label: 'Level',
      options: [1, 2],
      default: 2,
      localizable: false,
      accepts: [],
    },
    custom: { kind: 'text', label: 'Custom thing', default: '', localizable: false, accepts: [] },
  },
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
} as unknown as ComponentMeta;
const acme = { ...heading, type: 'acme/widget', label: 'Widget' } as ComponentMeta;
const manifest: RegistryManifest = {
  hash: 'x',
  components: { 'buildr/heading': heading, 'acme/widget': acme },
  templates: {
    'buildr/pricing': {
      id: 'buildr/pricing',
      version: 1,
      label: 'Pricing',
      category: 'marketing',
      lock: 'none',
      tree: { id: 'a', type: 'buildr/page' },
    } as never,
  },
};

describe('localizeManifest', () => {
  it('replaces component, template, prop and option labels from the Polish catalog', () => {
    const pl = localizeManifest(manifest, 'pl');
    expect(pl.components['buildr/heading']?.label).toBe('Nagłówek');
    expect(pl.components['buildr/heading']?.props['text']?.label).toBe('Tekst');
    expect(pl.templates['buildr/pricing']?.label).toBe('Cennik');
    const level = pl.components['buildr/heading']?.props['level'];
    expect(level?.kind === 'select' && level.optionLabels?.['1']).toBe('Poziom 1 (H1)');
  });

  it('falls back to the manifest label for what the catalog does not know', () => {
    const pl = localizeManifest(manifest, 'pl-PL');
    expect(pl.components['acme/widget']?.label).toBe('Widget');
    expect(pl.components['buildr/heading']?.props['custom']?.label).toBe('Custom thing');
  });

  it('keeps ids and option values, and returns the manifest itself for English', () => {
    const pl = localizeManifest(manifest, 'pl');
    expect(Object.keys(pl.components)).toEqual(Object.keys(manifest.components));
    expect(localizeManifest(manifest, 'en')).toBe(manifest);
    expect(labelCatalog('xx')).toBeUndefined();
    expect(localizeManifest(manifest, 'pl')).toBe(pl);
  });
});
