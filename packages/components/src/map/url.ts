import { checkExternalUrl } from '../media/external.ts';
import { MAP_API_KEY_REGEX, MAP_EMBED_ORIGIN, MAP_LOCALE_REGEX } from './props.ts';
export function normalizeQuery(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const query = (raw as string & { toWellFormed(): string })
    .toWellFormed()
    .replace(/\s+/gu, ' ')
    .replace(/[\p{Cc}]/gu, '')
    .trim();
  return query !== '' && [...query].length <= 256 ? query : undefined;
}
export function clampZoom(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw)
    ? Math.max(0, Math.min(21, Math.round(raw)))
    : 15;
}
export function normalizeMapType(raw: unknown): 'roadmap' | 'satellite' {
  return raw === 'satellite' ? raw : 'roadmap';
}
export type MapUrls =
  | { kind: 'nothing' }
  | { kind: 'link'; query: string; linkUrl: string }
  | { kind: 'frame'; query: string; linkUrl: string; frameUrl: string };
function valid(url: string, hosts?: readonly string[]): boolean {
  try {
    return checkExternalUrl(url, hosts).ok;
  } catch {
    return false;
  }
}
export function buildMapUrls(input: {
  query: unknown;
  zoom?: unknown;
  mapType?: unknown;
  locale?: unknown;
  apiKey?: unknown;
  iframeHosts?: readonly string[] | undefined;
}): MapUrls {
  const query = normalizeQuery(input.query);
  if (query === undefined) return { kind: 'nothing' };
  const enc = (v: unknown) => encodeURIComponent(String(v));
  const linkUrl = `${MAP_EMBED_ORIGIN}/maps/search/?api=1&query=${enc(query)}`;
  if (!valid(linkUrl)) return { kind: 'nothing' };
  const link = { kind: 'link' as const, query, linkUrl };
  if (typeof input.apiKey !== 'string' || !MAP_API_KEY_REGEX.test(input.apiKey)) return link;
  const language =
    typeof input.locale === 'string' && MAP_LOCALE_REGEX.test(input.locale)
      ? `&language=${enc(input.locale)}`
      : '';
  const frameUrl = `${MAP_EMBED_ORIGIN}/maps/embed/v1/place?key=${enc(input.apiKey)}&q=${enc(query)}&zoom=${enc(clampZoom(input.zoom))}&maptype=${enc(normalizeMapType(input.mapType))}${language}`;
  return valid(frameUrl, input.iframeHosts) ? { ...link, kind: 'frame', frameUrl } : link;
}
