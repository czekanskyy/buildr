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
  /** The public path of the document, when the collection defines one. */
  previewPath: z.string().nullable(),
  readOnly: z.boolean().optional(),
});
export type DocumentResponse = z.infer<typeof documentResponseSchema>;

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
