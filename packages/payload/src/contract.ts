import {
  dataSchemaSchema,
  mediaAssetSchema,
  queryResultSchema,
  resolvedQuerySpecSchema,
} from '@buildr/core';
import { z } from 'zod';

/**
 * The builder API contract (docs/payload.md#endpoint-contract): the request and response shapes of
 * `/api/buildr/*`, defined once and shared by the endpoint implementations and the HTTP adapter.
 * Documents travel as `unknown`; they are validated by `processLayout` on the server and by
 * `parseDocument` in the adapter, not by these schemas.
 */

export const diagnosticSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['error', 'warning']),
  path: z.array(z.union([z.string(), z.number()])).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ContractDiagnostic = z.infer<typeof diagnosticSchema>;

export const documentRefSchema = z.object({
  collection: z.string(),
  id: z.union([z.string(), z.number()]),
});

export const sessionResponseSchema = z.object({
  user: z.object({ id: z.union([z.string(), z.number()]), email: z.string().optional() }),
  permissions: z.object({
    canEdit: z.boolean(),
    canPublish: z.boolean(),
    canUnlockTemplates: z.boolean(),
  }),
  limits: z.object({ maxNodes: z.number(), maxBytes: z.number() }),
  /** The languages of the site; absent without Payload localization. */
  locales: z
    .object({
      locales: z.array(z.string()),
      default: z.string(),
      fallback: z.boolean(),
      intl: z.record(z.string(), z.string()),
    })
    .optional(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const documentQuerySchema = z.object({
  draft: z.enum(['0', '1']).optional(),
  locale: z.string().optional(),
});

export const documentResponseSchema = z.object({
  ref: documentRefSchema,
  title: z.string(),
  slug: z.string().nullable(),
  status: z.enum(['draft', 'published']),
  updatedAt: z.string(),
  /** Changes with every builder save; the next save says which one it builds on. */
  revision: z.number().int().nonnegative(),
  document: z.unknown(),
  /** What the canvas gets as its data context: `{collection}:{id}`. */
  contextRef: z.string(),
  /**
   * Where `document` came from: the document's own layout, its template, the collection's default
   * template, or nothing yet (`builtin`: the canvas is blank and the site shows the built-in layout).
   */
  layoutSource: z.enum(['document', 'template', 'default-template', 'builtin']),
  /** `{collection}:{id}` of the document that holds the layout; `null` for `builtin`. */
  layoutRef: z.string().nullable(),
  /** The public path of the document, when the collection defines one. */
  previewPath: z.string().nullable(),
  readOnly: z.boolean().optional(),
});
export type DocumentResponse = z.infer<typeof documentResponseSchema>;

/** `GET /api/buildr/documents/:collection/:id/revision`: the revision without the document. */
export const revisionResponseSchema = z.object({
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  /** Who made the last builder write (a name or an email); only with `mcp.enabled`. */
  updatedBy: z.string().optional(),
});
export type RevisionResponse = z.infer<typeof revisionResponseSchema>;

export const saveRequestSchema = z.object({
  document: z.unknown(),
  baseRevision: z.number().int().nonnegative(),
  autosave: z.boolean(),
});
export type SaveRequest = z.infer<typeof saveRequestSchema>;

export const saveResponseSchema = z.object({
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
export type SaveResponse = z.infer<typeof saveResponseSchema>;

export const publishRequestSchema = z.object({ baseRevision: z.number().int().nonnegative() });
export type PublishRequest = z.infer<typeof publishRequestSchema>;

export const publishResponseSchema = z.object({
  status: z.literal('published'),
  publishedAt: z.string(),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
export type PublishResponse = z.infer<typeof publishResponseSchema>;

/** `409`: somebody saved in the meantime. */
export const conflictResponseSchema = z.object({ currentRevision: z.number().int().nonnegative() });
export type ConflictResponse = z.infer<typeof conflictResponseSchema>;

/** `422`: the document is not acceptable; `diagnostics` say why. */
export const invalidResponseSchema = z.object({ diagnostics: z.array(diagnosticSchema) });
export type InvalidResponse = z.infer<typeof invalidResponseSchema>;

/** Every other refusal (`400`, `401`, `403`, `404`). */
export const errorResponseSchema = z.object({ error: z.string() });
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** The base path of the builder API under Payload's `routes.api`. */
export const BUILDR_API_PATH = '/buildr';

/** `GET /buildr/data-schema/:collection` answers with core's `DataSchema`. */
export const dataSchemaResponseSchema = dataSchemaSchema;

export const dataContextQuerySchema = z.object({
  collection: z.string().min(1),
  id: z.string().min(1),
  draft: z.enum(['0', '1']).optional(),
  locale: z.string().optional(),
});

/** The scopes a canvas binds against: `{ site, [context]: doc, route }`. */
export const dataContextResponseSchema = z.object({ scopes: z.record(z.string(), z.unknown()) });
export type DataContextResponse = z.infer<typeof dataContextResponseSchema>;

export const samplesResponseSchema = z.object({
  items: z.array(z.object({ id: z.string(), title: z.string() })),
});
export type SamplesResponse = z.infer<typeof samplesResponseSchema>;

/** `POST /buildr/data/query`: one resolved query, answered with the access of the editing user. */
export const dataQueryRequestSchema = z.object({
  spec: resolvedQuerySpecSchema,
  locale: z.string().optional(),
});
export type DataQueryRequest = z.infer<typeof dataQueryRequestSchema>;
export const dataQueryResponseSchema = queryResultSchema;

/** `POST /buildr/data/media`: media assets by id; unknown ids are left out. */
export const dataMediaRequestSchema = z.object({
  ids: z.array(z.string().min(1)).max(100),
  locale: z.string().optional(),
});
export type DataMediaRequest = z.infer<typeof dataMediaRequestSchema>;
export const dataMediaResponseSchema = z.record(z.string(), mediaAssetSchema);

/** `GET /buildr/media?search&type&page`: the picker's listing. */
export const mediaListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  type: z.enum(['image', 'video', 'audio']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  locale: z.string().max(35).optional(),
});
export const mediaListResponseSchema = z.object({
  items: z.array(mediaAssetSchema),
  page: z.number().int(),
  totalPages: z.number().int(),
});
export type MediaListResponse = z.infer<typeof mediaListResponseSchema>;

/** How many documents a page of `GET /buildr/documents` holds. */
export const DOCUMENT_LIST_PAGE_SIZE = 20;

/** `GET /buildr/documents?collection&search&page`: the builder documents the user may read. */
export const documentListQuerySchema = z.object({
  collection: z.string().min(1),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

/** One document in a listing (and the answer of a creation): enough to pick it and open it. */
export const documentSummarySchema = z.object({
  ref: documentRefSchema,
  title: z.string(),
  slug: z.string().nullable(),
  status: z.enum(['draft', 'published']),
  updatedAt: z.string(),
  /** The `baseRevision` an open + save starts from. */
  revision: z.number().int().nonnegative(),
  layoutSource: z.enum(['document', 'template', 'default-template', 'builtin']),
  previewPath: z.string().nullable(),
});
export type DocumentSummary = z.infer<typeof documentSummarySchema>;

export const documentListResponseSchema = z.object({
  items: z.array(documentSummarySchema),
  page: z.number().int(),
  totalPages: z.number().int(),
});
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;

/** `POST /buildr/documents`: creates a draft (never published) in a builder collection. */
export const createDocumentRequestSchema = z.object({
  collection: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words separated by hyphens')
    .optional(),
  /** The id of a template of the collection (`buildr-templates`) the document starts from. */
  template: z.union([z.string().min(1), z.number()]).optional(),
});
export type CreateDocumentRequest = z.infer<typeof createDocumentRequestSchema>;

/** `201`: the new draft. */
export const createDocumentResponseSchema = documentSummarySchema;
export type CreateDocumentResponse = DocumentSummary;
