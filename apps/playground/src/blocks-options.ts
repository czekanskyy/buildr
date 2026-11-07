import {
  createGalleryDataSource,
  defaultTheme,
  gallerySampleScopes,
} from '@next-buildr/components';
import { demoPlatform } from '@next-buildr/test-utils/demo/components';
import type { parseBlocksRoute } from './blocks-route.ts';
import { registry } from './registry.ts';
// Deliberately fake; only the explicit production fixture opt-in receives it.
export const MAP_TEST_KEY = `FAKE_MAP_KEY_${'0'.repeat(25)}X`;
export function createBlocksOptions(route: ReturnType<typeof parseBlocksRoute>) {
  const maps = route.mode !== 'canvas' && route.mapKey && route.entry === 'map-default';
  return {
    registry,
    theme: defaultTheme,
    platform: { ...demoPlatform, ...(maps ? { maps: { apiKey: MAP_TEST_KEY } } : {}) },
    ...(route.entry?.startsWith('map-')
      ? { capabilities: { iframeHosts: maps ? ['www.google.com'] : [] } }
      : {}),
    dataSource: createGalleryDataSource(),
    context: {
      scopes: gallerySampleScopes,
      locale: 'en',
      locales: { default: 'en', fallback: true, intl: { en: 'English' } },
      timeZone: 'UTC',
      mode: route.mode,
    },
  };
}
