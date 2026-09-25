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

  // TODO(lead, after PB-120): also assert that every `meta.icon` is a key of the editor's
  // `ComponentIcon` map. It is deliberately not asserted here because that map does not exist yet.
});
