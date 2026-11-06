// External media and embed URLs (ADR-028). The renderer validates them on every render: the editor's
// confirmation dialog and its own checks are feedback only.
import { type HostCapabilities, type MediaAsset, sanitizeUrl } from '@next-buildr/core';
import { isResolvedMedia } from '@next-buildr/react';

/** The longest external URL that is rendered. */
export const EXTERNAL_URL_MAX_LENGTH = 2048;

/**
 * What a media prop holds for a source outside the media library: `{ external: true, url }`. It is
 * not a `MediaRef`, so `prepareRender` never asks the data source for it. The editor writes it only
 * after the "Zewnętrzne źródło" confirmation of ADR-028; `mimeType` is optional, e.g. `video/mp4`.
 */
export interface ExternalMedia {
  readonly external: true;
  readonly url: string;
  readonly mimeType?: string;
}

export type ExternalUrlProblem =
  | 'empty'
  | 'too-long'
  | 'invalid'
  | 'not-https'
  | 'credentials'
  | 'host-not-allowed';

export type ExternalUrlCheck =
  | { readonly ok: true; readonly url: string; readonly host: string }
  | { readonly ok: false; readonly problem: ExternalUrlProblem };

/** The host allowlists a host may set on `capabilities` (ADR-028). */
export type HostListName = 'externalMediaHosts' | 'iframeHosts';

/**
 * The allowlist from the render env, or `undefined` (no restriction): only when the list is absent.
 * A list that is present but not an array fails closed and allows no host, as an empty array does;
 * entries that are not strings are dropped.
 */
export function hostsFrom(env: unknown, name: HostListName): readonly string[] | undefined {
  if (typeof env !== 'object' || env === null) return undefined;
  const capabilities = (env as { capabilities?: HostCapabilities }).capabilities;
  if (typeof capabilities !== 'object' || capabilities === null) return undefined;
  if (!Object.hasOwn(capabilities, name)) return undefined;
  const list: unknown = capabilities[name];
  if (list === undefined) return undefined;
  if (!Array.isArray(list)) return [];
  return list.filter((entry): entry is string => typeof entry === 'string');
}

function normalizeEntry(entry: string): string {
  return entry.trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
}

/** Whether `host` is one of `allowed` or a subdomain of one. `*.example.com` and `example.com` are the same entry. */
export function hostIsAllowed(host: string, allowed: readonly string[] | undefined): boolean {
  if (allowed === undefined) return true;
  const name = host.toLowerCase().replace(/\.$/, '');
  return allowed.some((entry) => {
    const base = normalizeEntry(entry);
    return base !== '' && (name === base || name.endsWith(`.${base}`));
  });
}

/**
 * HTTPS only, no credentials, a bounded length, and, when the host sets one, an allowlisted host.
 * The returned URL is the parsed, normalised `href`. Never throws.
 */
export function checkExternalUrl(raw: unknown, allowed?: readonly string[]): ExternalUrlCheck {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, problem: 'empty' };
  const value = raw.trim();
  if (value.length > EXTERNAL_URL_MAX_LENGTH) return { ok: false, problem: 'too-long' };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, problem: 'invalid' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, problem: 'not-https' };
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, problem: 'credentials' };
  }
  if (parsed.hostname === '') return { ok: false, problem: 'invalid' };
  // Control characters and the usual scheme obfuscation are rejected by the shared URL sanitiser.
  const clean = sanitizeUrl(parsed.href);
  if (!clean.ok || clean.value === '') return { ok: false, problem: 'invalid' };
  if (!hostIsAllowed(parsed.hostname, allowed)) return { ok: false, problem: 'host-not-allowed' };
  return { ok: true, url: parsed.href, host: parsed.hostname };
}

export function isExternalMedia(value: unknown): value is ExternalMedia {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { external?: unknown }).external === true &&
    typeof (value as { url?: unknown }).url === 'string'
  );
}

/** A media prop value that is usable: where it comes from, and the checked URL. */
export interface MediaSource {
  readonly url: string;
  /** `true` for an external URL, `false` for a media library asset. */
  readonly external: boolean;
  /** The library asset, when it is one; absent for an external source. */
  readonly asset?: MediaAsset;
  readonly mimeType?: string;
}

/** What a media prop that cannot be rendered, and why. */
export type MediaProblem =
  | { readonly kind: 'none' }
  | { readonly kind: 'invalid'; readonly problem: ExternalUrlProblem | 'unsafe-url' };

/** A same-origin path: one leading `/`, not `//host` or `/\host`, which a browser reads as another origin. */
const SAME_ORIGIN_PATH = /^\/(?![/\\])/;

const positiveInteger = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n > 0;

/** What is kept of an object that is not a resolved library asset: its URL and the plain facts about it. */
function plainAsset(value: Partial<MediaAsset>, url: string): MediaAsset {
  return {
    id: typeof value.id === 'string' ? value.id : '',
    url,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : '',
    ...(typeof value.alt === 'string' ? { alt: value.alt } : {}),
    ...(positiveInteger(value.width) ? { width: value.width } : {}),
    ...(positiveInteger(value.height) ? { height: value.height } : {}),
  };
}

/**
 * Resolves a media prop. Only an asset the renderer resolved from `PreparedData.media` (marked by
 * `markResolvedMedia`, which stored JSON cannot carry) is a library asset: its URL goes through the
 * shared sanitiser. Every other object with a `url` is author data (a raw object, or the snapshot
 * of a reference that was not prepared) and gets no more trust than an external source: it must be
 * a same-origin path (one leading `/`) or pass `checkExternalUrl` with the host's
 * `externalMediaHosts`. An external source is `{ external: true, url }`, checked the same way. An
 * unusable value gives no source.
 */
export function resolveMediaSource(
  value: unknown,
  hosts: readonly string[] | undefined,
): { readonly source?: MediaSource; readonly problem: MediaProblem } {
  if (value === null || value === undefined) return { problem: { kind: 'none' } };
  if (isExternalMedia(value)) {
    const checked = checkExternalUrl(value.url, hosts);
    if (!checked.ok) return { problem: { kind: 'invalid', problem: checked.problem } };
    return {
      problem: { kind: 'none' },
      source: {
        url: checked.url,
        external: true,
        ...(typeof value.mimeType === 'string' ? { mimeType: value.mimeType } : {}),
      },
    };
  }
  if (typeof value === 'object') {
    const asset = value as Partial<MediaAsset>;
    if (typeof asset.url !== 'string' || asset.url.trim() === '') {
      return { problem: { kind: 'none' } };
    }
    if (!isResolvedMedia(value)) {
      const raw = asset.url.trim();
      const mimeType =
        typeof asset.mimeType === 'string' && asset.mimeType !== ''
          ? { mimeType: asset.mimeType }
          : {};
      if (SAME_ORIGIN_PATH.test(raw)) {
        const path = sanitizeUrl(raw);
        if (!path.ok || path.value === '') {
          return { problem: { kind: 'invalid', problem: 'unsafe-url' } };
        }
        return {
          problem: { kind: 'none' },
          source: {
            url: path.value,
            external: false,
            asset: plainAsset(asset, path.value),
            ...mimeType,
          },
        };
      }
      const checked = checkExternalUrl(raw, hosts);
      if (!checked.ok) return { problem: { kind: 'invalid', problem: checked.problem } };
      return {
        problem: { kind: 'none' },
        source: { url: checked.url, external: true, ...mimeType },
      };
    }
    const clean = sanitizeUrl(asset.url);
    if (!clean.ok || clean.value === '') {
      return { problem: { kind: 'invalid', problem: 'unsafe-url' } };
    }
    return {
      problem: { kind: 'none' },
      source: {
        url: clean.value,
        external: false,
        asset: asset as MediaAsset,
        ...(typeof asset.mimeType === 'string' && asset.mimeType !== ''
          ? { mimeType: asset.mimeType }
          : {}),
      },
    };
  }
  return { problem: { kind: 'invalid', problem: 'invalid' } };
}
