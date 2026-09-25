import { componentIconNames } from '@buildr/editor';
import { describe, expect, it } from 'vitest';
import { registry } from './registry.ts';

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

describe('built-in component icons (PB-121)', () => {
  const metas = registry.meta.list();

  it('gives every component a kebab-case lucide icon name', () => {
    for (const meta of metas) {
      expect(meta.icon ?? '', meta.type).toMatch(KEBAB);
    }
  });

  it('never shares an icon between two built-in components', () => {
    const owners = new Map<string, string[]>();
    for (const meta of metas) {
      const icon = meta.icon ?? '';
      owners.set(icon, [...(owners.get(icon) ?? []), meta.type]);
    }
    const duplicates = [...owners].filter(([, types]) => types.length > 1);
    expect(duplicates).toEqual([]);
  });

  it('has every icon in the editor ComponentIcon map, so none falls back to the neutral box', () => {
    const known = new Set(componentIconNames);
    const missing = metas.filter((meta) => !known.has(meta.icon ?? '')).map((meta) => meta.type);
    expect(missing).toEqual([]);
  });
});
