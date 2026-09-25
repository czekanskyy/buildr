import {
  type ComponentMeta,
  createRegistryMeta,
  type DataSchema,
  type MediaAsset,
  p,
  type RegistryManifest,
  toManifest,
} from '@buildr/core';
import type { McpBackend } from '../backend.ts';
import { createMemoryBackend, type MemoryBackendOptions } from '../backends/memory.ts';

function component(type: string, overrides: Partial<ComponentMeta> = {}): ComponentMeta {
  return {
    type,
    version: 1,
    label: type.slice(type.indexOf('/') + 1),
    category: 'content',
    props: {},
    contentCategories: ['flow'],
    styles: { groups: [] },
    runtime: 'shared',
    ...overrides,
  };
}

/**
 * A tiny manifest (page, section, heading) for tests of the tool layer and of backends. The real
 * component catalogue lives in `@buildr/components`, which `@buildr/mcp` must not import.
 */
export function createTestManifest(): RegistryManifest {
  return toManifest(
    createRegistryMeta({
      components: [
        component('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
        component('buildr/section', { slots: { default: {} } }),
        component('buildr/heading', { props: { text: p.text({ default: 'Heading' }) } }),
      ],
    }),
  );
}

export const TEST_COLLECTION = 'pages';

export const TEST_DATA_SCHEMA: DataSchema = { scopes: {}, entities: {} };

export const TEST_MEDIA: readonly MediaAsset[] = [
  {
    id: 'm1',
    url: '/media/hero.jpg',
    alt: 'A hero image',
    mimeType: 'image/jpeg',
    width: 1200,
    height: 800,
  },
  { id: 'm2', url: '/media/intro.mp4', mimeType: 'video/mp4' },
];

/** A memory backend with two pages, media and a data schema; `overrides` replace any option. */
export function createTestMemoryBackend(overrides: Partial<MemoryBackendOptions> = {}): McpBackend {
  return createMemoryBackend({
    manifest: createTestManifest(),
    collections: [TEST_COLLECTION],
    documents: [
      { ref: { collection: TEST_COLLECTION, id: '1' }, title: 'Home', slug: 'home' },
      { ref: { collection: TEST_COLLECTION, id: '2' }, title: 'About us', slug: 'about' },
    ],
    dataSchemas: { [TEST_COLLECTION]: TEST_DATA_SCHEMA },
    media: TEST_MEDIA,
    ...overrides,
  });
}
