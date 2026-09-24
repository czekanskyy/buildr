import { z } from 'zod';
import type { JsonValue } from '../json/json-value.ts';
import { isJsonValue } from '../json/json-value.ts';
import type { ResolvedQuerySpec } from './query-spec.ts';

/** A reference to a media library entry, stored in a `media` prop (docs/payload.md#media). */
export interface MediaRef {
  readonly source: string;
  readonly collection: string;
  readonly id: string;
  /** A copy of the asset taken when it was picked: thumbnails in the editor and a fallback. */
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

/** A resolved media library entry. */
export interface MediaAsset {
  readonly id: string;
  readonly url: string;
  readonly alt?: string | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly mimeType: string;
  readonly focalPoint?: { readonly x: number; readonly y: number } | undefined;
  readonly sizes?:
    | Readonly<
        Record<string, { readonly url: string; readonly width: number; readonly height: number }>
      >
    | undefined;
}

/** The page of results a query returns. */
export interface QueryResult {
  readonly items: readonly JsonValue[];
  /** All matches, before paging. */
  readonly total: number;
  /** 1-based. */
  readonly page: number;
  readonly totalPages: number;
}

export const mediaRefSchema: z.ZodType<MediaRef> = z.object({
  source: z.string(),
  collection: z.string(),
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

export const mediaAssetSchema: z.ZodType<MediaAsset> = z.object({
  id: z.string().min(1),
  url: z.string(),
  alt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  mimeType: z.string(),
  focalPoint: z.object({ x: z.number(), y: z.number() }).optional(),
  sizes: z
    .record(z.string(), z.object({ url: z.string(), width: z.number(), height: z.number() }))
    .optional(),
});

export const queryResultSchema: z.ZodType<QueryResult> = z.object({
  items: z.array(z.custom<JsonValue>(isJsonValue)),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});

/** What a `DataSource` knows about the render it serves. */
export interface DataSourceContext {
  readonly locale: string;
  readonly mode: 'production' | 'preview' | 'canvas';
}

/**
 * Where declarative data comes from (docs/dynamic-bindings.md, ADR-018): `PayloadDataSource`
 * (server), `HttpDataSource` (canvas) and `MemoryDataSource` (tests) all implement it and are held
 * to the same contract suite. Methods reject on failure (network, access, an unknown collection
 * alias); `prepareRender` turns a rejection into a diagnostic. Implementations must not return
 * anything the requesting user may not read.
 */
export interface DataSource {
  /** Looks up media by id in one round trip. Ids that do not exist are simply absent from the result. */
  getMedia(
    ids: readonly string[],
    ctx: DataSourceContext,
  ): Promise<Readonly<Record<string, MediaAsset>>>;
  /** Runs a resolved query. Rejects when `spec.source` is not an allowed collection. */
  query(spec: ResolvedQuerySpec, ctx: DataSourceContext): Promise<QueryResult>;
}
