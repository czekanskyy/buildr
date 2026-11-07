import { parseGalleryRoute } from './route.ts';

/** Untrusted URL widths use the same bounded parser as the fixture gallery. */
export function parseBlocksRoute(search: string) {
  const params = new URLSearchParams(search);
  return {
    entry: params.get('entry') || undefined,
    width: parseGalleryRoute(search).width,
    mode:
      params.get('mode') === 'canvas'
        ? ('canvas' as const)
        : params.get('mode') === 'preview'
          ? ('preview' as const)
          : ('production' as const),
    mapKey: params.get('mapKey') === '1',
    captchaKey: params.get('captchaKey') === '1',
    staticMarkup: params.get('static') === '1',
  };
}
