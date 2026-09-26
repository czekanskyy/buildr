import type {
  BuilderDocument,
  DataSchema,
  Diagnostic,
  MediaAsset,
  RegistryManifest,
  Result,
  Theme,
} from '@next-buildr/core';
import { z } from 'zod';

/**
 * The seam every host and backend plugs into (ADR-024, docs/mcp.md#the-backend-interface): the tool
 * layer of `@next-buildr/mcp` never talks to a CMS, it talks to an `McpBackend`. It plays the role
 * `DocumentAdapter` plays for the editor. Implementations: `createMemoryBackend` (tests, playground),
 * the HTTP backend and the local backend in `@next-buildr/payload/mcp`.
 *
 * Contract every implementation honours (checked by `runBackendContract` from `@next-buildr/mcp/testing`):
 * - Methods never throw for expected failures; they resolve to `{ ok: false, error }` with a typed
 *   `McpError`. A thrown exception is a programmer error.
 * - Documents cross this boundary as `BuilderDocument`s that already passed `parseDocument`.
 * - The backend is the trust boundary: `save`/`publish` re-validate and check permissions, whatever
 *   the tool layer already did.
 * - Secrets (API keys) never appear in an error message.
 */

// --- Errors --------------------------------------------------------------------------------------

export type McpErrorCode = 'conflict' | 'invalid' | 'forbidden' | 'not-found' | 'network';

/** A typed failure. `message` is one sentence an agent (and a human) can act on. */
export type McpError =
  /** Somebody saved in the meantime; nothing was written. */
  | { readonly code: 'conflict'; readonly message: string; readonly currentRevision: number }
  /** The input was not acceptable; `diagnostics` say why (server-side `processLayout`, `parseDocument`). */
  | {
      readonly code: 'invalid';
      readonly message: string;
      readonly diagnostics: readonly Diagnostic[];
    }
  | { readonly code: 'forbidden'; readonly message: string }
  | { readonly code: 'not-found'; readonly message: string }
  /** The backend could not be reached or answered nonsense; `retryable` is true for transient failures. */
  | { readonly code: 'network'; readonly message: string; readonly retryable: boolean };

export type McpResult<T> = Result<T, McpError>;

export const MCP_ERROR_CODES: readonly McpErrorCode[] = [
  'conflict',
  'invalid',
  'forbidden',
  'not-found',
  'network',
];

/** Builds the failure half of an `McpResult`. */
export function mcpFail(error: McpError): { readonly ok: false; readonly error: McpError } {
  return { ok: false, error };
}

// --- Shapes (validated with Zod at the boundary) -------------------------------------------------

const revisionSchema = z.int().min(0);

export const documentRefSchema = z.object({
  collection: z.string().min(1).max(100),
  id: z.union([z.string().min(1).max(200), z.number()]),
});
export type DocumentRef = z.infer<typeof documentRefSchema>;

export const sessionSchema = z.object({
  user: z.object({ id: z.union([z.string(), z.number()]), email: z.string().optional() }),
  permissions: z.object({
    canEdit: z.boolean(),
    canPublish: z.boolean(),
    canUnlockTemplates: z.boolean(),
  }),
  limits: z.object({ maxNodes: z.int().positive(), maxBytes: z.int().positive() }),
  /**
   * What the site does with a document that has errors when it is published: `block` refuses it,
   * `warn` (the default when absent) publishes anyway. The `publish` tool enforces `block` itself,
   * on top of the backend.
   */
  publishPolicy: z.enum(['warn', 'block']).optional(),
  /** The languages of the site; absent for a single-language site. */
  locales: z
    .object({
      locales: z.array(z.string()).min(1),
      default: z.string(),
      fallback: z.boolean(),
      intl: z.record(z.string(), z.string()),
    })
    .optional(),
});
export type McpSession = z.infer<typeof sessionSchema>;

export const documentStatusSchema = z.enum(['draft', 'published']);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

/** What a listing returns per document: enough to pick one, never the layout itself. */
export const documentSummarySchema = z.object({
  ref: documentRefSchema,
  title: z.string(),
  slug: z.string().nullable(),
  status: documentStatusSchema,
  updatedAt: z.string(),
  revision: revisionSchema,
});
export type DocumentSummary = z.infer<typeof documentSummarySchema>;

export const listDocumentsQuerySchema = z.object({
  collection: z.string().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  status: documentStatusSchema.optional(),
  /** 1-based. */
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(100).default(25),
});
export type ListDocumentsQuery = z.input<typeof listDocumentsQuerySchema>;

export const listDocumentsResultSchema = z.object({
  items: z.array(documentSummarySchema),
  page: z.int().min(1),
  totalPages: z.int().min(0),
  total: z.int().min(0),
});
export type ListDocumentsResult = z.infer<typeof listDocumentsResultSchema>;

/** Creates a **draft** with an empty layout; creation never publishes (ADR-024, decision 7). */
export const createDocumentInputSchema = z.object({
  collection: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(200)
    .optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentInputSchema>;

export const loadOptionsSchema = z.object({ locale: z.string().max(35).optional() });
export type LoadOptions = z.infer<typeof loadOptionsSchema>;

export const layoutSourceSchema = z.enum(['document', 'template', 'default-template', 'builtin']);
export type LayoutSource = z.infer<typeof layoutSourceSchema>;

/** A document as `load` returns it; mirrors the builder HTTP contract's document response. */
export interface LoadedDocument extends DocumentSummary {
  readonly document: BuilderDocument;
  /** What the canvas gets as its data context: `{collection}:{id}`. */
  readonly contextRef: string;
  /** Where `document` came from; `builtin` means the layout is still blank. */
  readonly layoutSource: LayoutSource;
  /** `{collection}:{id}` of the document that holds the layout; `null` for `builtin`. */
  readonly layoutRef: string | null;
  /** The public path of the document, when the collection defines one. */
  readonly previewPath: string | null;
  readonly readOnly?: boolean;
}

export const saveResultSchema = z.object({ revision: revisionSchema, updatedAt: z.string() });
export type SaveResult = z.infer<typeof saveResultSchema>;

export const publishResultSchema = z.object({
  status: z.literal('published'),
  publishedAt: z.string(),
  revision: revisionSchema,
  updatedAt: z.string(),
});
export type PublishResult = z.infer<typeof publishResultSchema>;

export const listMediaQuerySchema = z.object({
  search: z.string().max(200).optional(),
  type: z.enum(['image', 'video', 'audio']).optional(),
  page: z.int().min(1).default(1),
});
export type ListMediaQuery = z.input<typeof listMediaQuerySchema>;

export interface ListMediaResult {
  readonly items: readonly MediaAsset[];
  readonly page: number;
  readonly totalPages: number;
}

/** The revision a document was loaded at; what `save` and `publish` build on. */
export const baseRevisionSchema = revisionSchema;

// --- The interface -------------------------------------------------------------------------------

export interface McpBackend {
  /** The signed-in agent user, its permissions, the document limits and the site's languages. */
  getSession(): Promise<McpResult<McpSession>>;
  /** The component manifest of the site's registry (custom components included). */
  getManifest(): Promise<McpResult<RegistryManifest>>;
  getTheme(): Promise<McpResult<Theme>>;
  listDocuments(query?: ListDocumentsQuery): Promise<McpResult<ListDocumentsResult>>;
  createDocument(input: CreateDocumentInput): Promise<McpResult<DocumentSummary>>;
  /** Loads the document for editing (the draft when there is one). */
  load(ref: DocumentRef, options?: LoadOptions): Promise<McpResult<LoadedDocument>>;
  /**
   * Persists `doc` as the new draft. `baseRevision` is the revision the caller loaded; when the
   * document has moved on nothing is written and the result is `conflict` with `currentRevision`.
   */
  save(
    ref: DocumentRef,
    doc: BuilderDocument,
    baseRevision: number,
  ): Promise<McpResult<SaveResult>>;
  /** Publishes the current draft; same `baseRevision` semantics as `save`. Needs `canPublish`. */
  publish(ref: DocumentRef, baseRevision: number): Promise<McpResult<PublishResult>>;
  /** The statically-known data shape (scopes, entities) bindings of a collection's documents can use. */
  getDataSchema(collection: string): Promise<McpResult<DataSchema>>;
  listMedia(query?: ListMediaQuery): Promise<McpResult<ListMediaResult>>;
  /** An absolute or site-relative URL to view the document, or `null` when it has no public path. */
  previewUrl(ref: DocumentRef, locale?: string): Promise<McpResult<string | null>>;
}
