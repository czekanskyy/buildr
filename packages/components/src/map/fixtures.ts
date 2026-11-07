import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';
// Host configuration for opt-in previews only; never a document prop.
export const MAP_FIXTURE_KEY = `FAKE_MAP_KEY_${'0'.repeat(26)}X`;
export const mapFixtures: readonly ComponentFixture[] = [
  ...['default', 'satellite', 'unicode', 'no-key'].map((name) => ({
    id: `map-${name}`,
    title: `Map: ${name}`,
    tree: {
      type: 'buildr/map',
      props: {
        query: s(name === 'unicode' ? '東京 🗺️ Rynek Główny 1, Kraków' : 'Rynek Główny 1, Kraków'),
        mapType: s(name === 'satellite' ? 'satellite' : 'roadmap'),
      },
    },
  })),
  {
    id: 'map-bound',
    title: 'Map: bound query and title',
    tree: {
      type: 'buildr/map',
      props: {
        query: { kind: 'binding', path: 'map.query' },
        title: { kind: 'binding', path: 'map.title' },
      } as never,
    },
  },
];
