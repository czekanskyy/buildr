import type { MediaAsset } from '@next-buildr/core';
import { z } from 'zod';

/** What a media prop stores (docs/payload.md#media): a reference, plus a snapshot to show while the library is not asked. */
export interface MediaRef {
  readonly source: 'payload';
  readonly collection: string;
  readonly id: string;
  readonly snapshot?:
    | {
        readonly url: string;
        readonly alt?: string | undefined;
        readonly width?: number | undefined;
        readonly height?: number | undefined;
        readonly mimeType?: string | undefined;
      }
    | undefined;
}

export const mediaRefSchema: z.ZodType<MediaRef> = z.object({
  source: z.literal('payload'),
  collection: z.string().min(1),
  id: z.string().min(1),
  snapshot: z
    .object({
      url: z.string(),
      alt: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      mimeType: z.string().optional(),
    })
    .optional(),
});

/** The value of a media prop, when it is a reference; anything else (`null`, a stale shape) is `undefined`. */
export function parseMediaRef(value: unknown): MediaRef | undefined {
  const parsed = mediaRefSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** The reference to store for a library entry; the snapshot carries only what a thumbnail needs. */
export function toMediaRef(asset: MediaAsset, collection: string): MediaRef {
  return {
    source: 'payload',
    collection,
    id: asset.id,
    snapshot: {
      url: asset.url,
      ...(asset.alt !== undefined ? { alt: asset.alt } : {}),
      ...(asset.width !== undefined ? { width: asset.width } : {}),
      ...(asset.height !== undefined ? { height: asset.height } : {}),
      mimeType: asset.mimeType,
    },
  };
}

/** What a media prop stores for a file outside the library (ADR-028); the renderer validates it again on every render. */
export interface ExternalMedia {
  readonly external: true;
  readonly url: string;
  readonly mimeType?: string | undefined;
}

export const externalMediaSchema: z.ZodType<ExternalMedia> = z.object({
  external: z.literal(true),
  url: z.string().min(1),
  mimeType: z.string().optional(),
});

/** The value of a media prop, when it is an external URL; anything else is `undefined`. */
export function parseExternalMedia(value: unknown): ExternalMedia | undefined {
  const parsed = externalMediaSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export const MAX_EXTERNAL_URL_LENGTH = 2048;

/**
 * The URL to store for what an author typed, or `undefined` when it is not acceptable: HTTPS only,
 * no credentials, a bounded length. Feedback only; the renderer validates stored values itself.
 */
export function normalizeExternalUrl(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.length > MAX_EXTERNAL_URL_LENGTH) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** Which kinds of file the picker offers. The prop's `accept` (`['image']`) narrows the choice. */
export type MediaKind = 'all' | 'image' | 'video' | 'document';

export const MEDIA_KINDS: readonly MediaKind[] = ['all', 'image', 'video', 'document'];

const MIME_PATTERNS: Record<Exclude<MediaKind, 'all'>, readonly string[]> = {
  image: ['image/*'],
  video: ['video/*'],
  document: ['application/pdf'],
};

/** The MIME filter the library is asked with; `undefined` for no filter. */
export function mimeTypesFor(kind: MediaKind): readonly string[] | undefined {
  return kind === 'all' ? undefined : MIME_PATTERNS[kind];
}

/** The kinds a prop's `accept` allows: all of them when it names none. */
export function kindsFor(accept: readonly string[] | undefined): readonly MediaKind[] {
  if (accept === undefined || accept.length === 0) return MEDIA_KINDS;
  const allowed = MEDIA_KINDS.filter((kind) => kind !== 'all' && accept.includes(kind));
  return allowed.length === 0 ? MEDIA_KINDS : allowed;
}
