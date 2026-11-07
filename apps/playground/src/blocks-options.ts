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
// Cloudflare's published always-pass TEST site key; confined to this playground fixture route.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
export const CAPTCHA_TEST_KEY = '1x00000000000000000000AA';
export function createBlocksOptions(route: ReturnType<typeof parseBlocksRoute>) {
  const maps = route.mode !== 'canvas' && route.mapKey && route.entry === 'map-default';
  const captcha =
    route.mode !== 'canvas' &&
    route.captchaKey &&
    ['captcha-default', 'captcha-invalid-site-key', 'captcha-multiple', 'captcha-auto'].includes(
      route.entry ?? '',
    );
  return {
    registry,
    theme: defaultTheme,
    layoutRef: 'pages:blocks',
    platform: {
      ...demoPlatform,
      ...(maps ? { maps: { apiKey: MAP_TEST_KEY } } : {}),
      ...(captcha
        ? {
            captcha: {
              provider: 'turnstile' as const,
              siteKey:
                route.entry === 'captcha-invalid-site-key' ? 'invalid site key!' : CAPTCHA_TEST_KEY,
              clickToLoad: route.entry !== 'captcha-auto',
            },
          }
        : {}),
    },
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
