import { parseGalleryRoute } from './route.ts';

/** Untrusted URL widths use the same bounded parser as the fixture gallery. */
export function parseBlocksRoute(search: string) {
  const params = new URLSearchParams(search);
  return {
    entry: params.get('entry') || undefined,
    width: parseGalleryRoute(search).width,
    staticMarkup: params.get('static') === '1',
  };
}
