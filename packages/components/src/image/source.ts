import { type MediaAsset, sanitizeUrl } from '@buildr/core';

/** The safe URL of an asset, or nothing: an unsafe one (`javascript:`, `data:`) is never rendered. */
export function safeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string' || url.trim() === '') return undefined;
  const result = sanitizeUrl(url);
  return result.ok && result.value !== '' ? result.value : undefined;
}

const positive = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

/**
 * `srcset` from the sizes the media library generated, plus the original: `"<url> <w>w, ..."`,
 * narrowest first, one entry per width. Unsafe URLs and sizes without a usable width are left out.
 */
export function buildSrcSet(
  asset: Pick<MediaAsset, 'url' | 'width' | 'sizes'>,
): string | undefined {
  const byWidth = new Map<number, string>();
  for (const size of Object.values(asset.sizes ?? {})) {
    const url = safeUrl(size?.url);
    if (url !== undefined && positive(size?.width)) byWidth.set(size.width, url);
  }
  const original = safeUrl(asset.url);
  if (original !== undefined && positive(asset.width) && !byWidth.has(asset.width)) {
    byWidth.set(asset.width, original);
  }
  if (byWidth.size < 2) return undefined;
  return [...byWidth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([width, url]) => `${url} ${width}w`)
    .join(', ');
}

/** The `sizes` attribute for a display-width preset. */
export const SIZES_ATTRIBUTE: Readonly<Record<string, string>> = {
  full: '100vw',
  half: '(min-width: 768px) 50vw, 100vw',
  third: '(min-width: 768px) 33vw, 100vw',
  quarter: '(min-width: 768px) 25vw, 100vw',
};

/** A focal point (0 to 1 on each axis) as `object-position`; anything else is ignored. */
export function objectPosition(point: MediaAsset['focalPoint']): string | undefined {
  if (point === undefined || point === null) return undefined;
  const { x, y } = point;
  const ok = (n: unknown): n is number => typeof n === 'number' && n >= 0 && n <= 1;
  return ok(x) && ok(y) ? `${Math.round(x * 1000) / 10}% ${Math.round(y * 1000) / 10}%` : undefined;
}
