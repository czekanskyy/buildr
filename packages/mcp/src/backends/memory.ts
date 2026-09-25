import {
  type BuilderDocument,
  createEmptyDocument,
  type DataSchema,
  DEFAULT_DOCUMENT_LIMITS,
  defaultTheme,
  type MediaAsset,
  ok,
  parseDocument,
  type RegistryManifest,
  type Theme,
} from '@buildr/core';
import {
  baseRevisionSchema,
  type CreateDocumentInput,
  createDocumentInputSchema,
  type DocumentRef,
  type DocumentStatus,
  type DocumentSummary,
  documentRefSchema,
  type LayoutSource,
  type ListDocumentsQuery,
  type ListMediaQuery,
  type LoadedDocument,
  listDocumentsQuerySchema,
  listMediaQuerySchema,
  type McpBackend,
  type McpResult,
  type McpSession,
  mcpFail,
} from '../backend.ts';

const MEDIA_PAGE_SIZE = 20;

export interface MemoryDocumentInput {
  readonly ref: DocumentRef;
  readonly title: string;
  readonly slug?: string | null;
  readonly status?: DocumentStatus;
  /** Defaults to an empty page. */
  readonly document?: BuilderDocument;
  /** Defaults to 0. */
  readonly revision?: number;
  /** Defaults to `/<slug>` (`null` without a slug). */
  readonly previewPath?: string | null;
}

export interface MemoryBackendOptions {
  readonly manifest: RegistryManifest;
  readonly theme?: Theme;
  readonly documents?: readonly MemoryDocumentInput[];
  /** Collections that exist although they hold no document yet (creation needs the collection to exist). */
  readonly collections?: readonly string[];
  /** Overrides parts of the default session (edit and publish allowed, core's default limits). */
  readonly session?: Partial<Omit<McpSession, 'permissions'>> & {
    readonly permissions?: Partial<McpSession['permissions']>;
  };
  readonly dataSchemas?: Readonly<Record<string, DataSchema>>;
  readonly media?: readonly MediaAsset[];
  /** Prepended to `previewPath` by `previewUrl`; without it the site-relative path is returned. */
  readonly previewBaseUrl?: string;
  /** Injected for deterministic tests. */
  readonly now?: () => Date;
}

interface StoredDocument {
  ref: DocumentRef;
  title: string;
  slug: string | null;
  status: DocumentStatus;
  revision: number;
  updatedAt: string;
  document: BuilderDocument;
  previewPath: string | null;
}

// Everything crossing the backend boundary is JSON, so a JSON round trip is a faithful deep copy
// (and keeps callers from mutating the store through a returned reference).
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function keyOf(ref: DocumentRef): string {
  return `${ref.collection}:${String(ref.id)}`;
}

/**
 * An in-memory `McpBackend` for tests and the playground (docs/mcp.md#memory-backend). It implements
 * the full contract, including revisions, conflicts, permissions and server-side document validation,
 * so the tool layer can be exercised without a CMS.
 */
export function createMemoryBackend(options: MemoryBackendOptions): McpBackend {
  const now = options.now ?? (() => new Date());
  const session: McpSession = {
    user: options.session?.user ?? { id: 'memory-agent', email: 'agent@example.test' },
    permissions: {
      canEdit: true,
      canPublish: true,
      canUnlockTemplates: false,
      ...options.session?.permissions,
    },
    limits: options.session?.limits ?? {
      maxNodes: DEFAULT_DOCUMENT_LIMITS.maxNodes,
      maxBytes: DEFAULT_DOCUMENT_LIMITS.maxDocumentBytes,
    },
    ...(options.session?.publishPolicy ? { publishPolicy: options.session.publishPolicy } : {}),
    ...(options.session?.locales ? { locales: options.session.locales } : {}),
  };
  const theme = options.theme ?? defaultTheme;
  const store = new Map<string, StoredDocument>();
  const collections = new Set(options.collections ?? []);
  let nextId = 1;

  for (const input of options.documents ?? []) {
    const ref = documentRefSchema.parse(input.ref);
    const slug = input.slug ?? null;
    store.set(keyOf(ref), {
      ref,
      title: input.title,
      slug,
      status: input.status ?? 'draft',
      revision: input.revision ?? 0,
      updatedAt: now().toISOString(),
      document: clone(input.document ?? createEmptyDocument()),
      previewPath: input.previewPath !== undefined ? input.previewPath : slug ? `/${slug}` : null,
    });
    collections.add(ref.collection);
  }

  const summary = (d: StoredDocument): DocumentSummary => ({
    ref: { ...d.ref },
    title: d.title,
    slug: d.slug,
    status: d.status,
    updatedAt: d.updatedAt,
    revision: d.revision,
  });

  const notFound = (ref: DocumentRef) =>
    mcpFail({ code: 'not-found', message: `There is no document ${keyOf(ref)}.` });

  function find(refInput: DocumentRef): McpResult<StoredDocument> {
    const parsed = documentRefSchema.safeParse(refInput);
    if (!parsed.success) {
      return mcpFail({
        code: 'invalid',
        message: 'The document reference is not valid.',
        diagnostics: parsed.error.issues.map((issue) => ({
          code: 'mcp.invalid-ref',
          message: issue.message,
          severity: 'error' as const,
        })),
      });
    }
    const found = store.get(keyOf(parsed.data));
    return found ? ok(found) : notFound(parsed.data);
  }

  function requireBase(
    doc: StoredDocument,
    baseRevision: number,
    action: string,
  ): McpResult<StoredDocument> {
    if (!baseRevisionSchema.safeParse(baseRevision).success) {
      return mcpFail({
        code: 'invalid',
        message: 'baseRevision must be a non-negative integer.',
        diagnostics: [
          { code: 'mcp.invalid-base-revision', message: 'invalid baseRevision', severity: 'error' },
        ],
      });
    }
    if (baseRevision !== doc.revision) {
      return mcpFail({
        code: 'conflict',
        message: `Cannot ${action}: the document is at revision ${doc.revision} but you built on revision ${baseRevision}. Reload it and reapply your changes.`,
        currentRevision: doc.revision,
      });
    }
    return ok(doc);
  }

  return {
    async getSession() {
      return ok(clone(session));
    },

    async getManifest() {
      return ok(options.manifest);
    },

    async getTheme() {
      return ok(theme);
    },

    async listDocuments(query?: ListDocumentsQuery) {
      const parsed = listDocumentsQuerySchema.safeParse(query ?? {});
      if (!parsed.success) {
        return mcpFail({
          code: 'invalid',
          message: 'The listing query is not valid.',
          diagnostics: parsed.error.issues.map((issue) => ({
            code: 'mcp.invalid-query',
            message: issue.message,
            severity: 'error' as const,
          })),
        });
      }
      const q = parsed.data;
      const needle = q.search?.toLowerCase();
      const matches = [...store.values()]
        .filter((d) => (q.collection ? d.ref.collection === q.collection : true))
        .filter((d) => (q.status ? d.status === q.status : true))
        .filter((d) =>
          needle ? d.title.toLowerCase().includes(needle) || d.slug?.includes(needle) : true,
        )
        .sort((a, b) => keyOf(a.ref).localeCompare(keyOf(b.ref), 'en', { numeric: true }));
      const start = (q.page - 1) * q.limit;
      return ok({
        items: matches.slice(start, start + q.limit).map(summary),
        page: q.page,
        totalPages: Math.ceil(matches.length / q.limit),
        total: matches.length,
      });
    },

    async createDocument(input: CreateDocumentInput) {
      const parsed = createDocumentInputSchema.safeParse(input);
      if (!parsed.success) {
        return mcpFail({
          code: 'invalid',
          message: 'The document input is not valid.',
          diagnostics: parsed.error.issues.map((issue) => ({
            code: 'mcp.invalid-input',
            message: `${issue.path.join('.')}: ${issue.message}`,
            severity: 'error' as const,
          })),
        });
      }
      if (!session.permissions.canEdit) {
        return mcpFail({ code: 'forbidden', message: 'This user may not create documents.' });
      }
      if (!collections.has(parsed.data.collection)) {
        return mcpFail({
          code: 'not-found',
          message: `There is no collection "${parsed.data.collection}".`,
        });
      }
      let id = String(nextId++);
      while (store.has(`${parsed.data.collection}:${id}`)) id = String(nextId++);
      const ref: DocumentRef = { collection: parsed.data.collection, id };
      const created: StoredDocument = {
        ref,
        title: parsed.data.title,
        slug: parsed.data.slug ?? null,
        status: 'draft',
        revision: 0,
        updatedAt: now().toISOString(),
        document: createEmptyDocument(),
        previewPath: parsed.data.slug ? `/${parsed.data.slug}` : null,
      };
      store.set(keyOf(ref), created);
      return ok(summary(created));
    },

    async load(ref) {
      const found = find(ref);
      if (!found.ok) return found;
      const d = found.value;
      const blank = Object.keys(d.document.nodes).length <= 1;
      const layoutSource: LayoutSource = blank ? 'builtin' : 'document';
      const loaded: LoadedDocument = {
        ...summary(d),
        document: clone(d.document),
        contextRef: keyOf(d.ref),
        layoutSource,
        layoutRef: blank ? null : keyOf(d.ref),
        previewPath: d.previewPath,
        ...(session.permissions.canEdit ? {} : { readOnly: true }),
      };
      return ok(loaded);
    },

    async save(ref, doc, baseRevision) {
      const found = find(ref);
      if (!found.ok) return found;
      if (!session.permissions.canEdit) {
        return mcpFail({ code: 'forbidden', message: 'This user may not edit documents.' });
      }
      const based = requireBase(found.value, baseRevision, 'save');
      if (!based.ok) return based;
      const parsed = parseDocument(doc, {
        ...DEFAULT_DOCUMENT_LIMITS,
        maxNodes: Math.min(DEFAULT_DOCUMENT_LIMITS.maxNodes, session.limits.maxNodes),
        maxDocumentBytes: Math.min(
          DEFAULT_DOCUMENT_LIMITS.maxDocumentBytes,
          session.limits.maxBytes,
        ),
      });
      if (!parsed.ok) {
        return mcpFail({
          code: 'invalid',
          message: 'The document was rejected; nothing was saved.',
          diagnostics: parsed.error,
        });
      }
      const target = found.value;
      target.document = clone(parsed.value);
      target.revision += 1;
      target.updatedAt = now().toISOString();
      target.status = 'draft';
      return ok({ revision: target.revision, updatedAt: target.updatedAt });
    },

    async publish(ref, baseRevision) {
      const found = find(ref);
      if (!found.ok) return found;
      if (!session.permissions.canPublish) {
        return mcpFail({ code: 'forbidden', message: 'This user may not publish documents.' });
      }
      const based = requireBase(found.value, baseRevision, 'publish');
      if (!based.ok) return based;
      const target = found.value;
      target.revision += 1;
      target.updatedAt = now().toISOString();
      target.status = 'published';
      return ok({
        status: 'published' as const,
        publishedAt: target.updatedAt,
        revision: target.revision,
        updatedAt: target.updatedAt,
      });
    },

    async getDataSchema(collection) {
      const schema = options.dataSchemas?.[collection];
      return schema
        ? ok(clone(schema))
        : mcpFail({ code: 'not-found', message: `There is no data schema for "${collection}".` });
    },

    async listMedia(query?: ListMediaQuery) {
      const parsed = listMediaQuerySchema.safeParse(query ?? {});
      if (!parsed.success) {
        return mcpFail({
          code: 'invalid',
          message: 'The media query is not valid.',
          diagnostics: parsed.error.issues.map((issue) => ({
            code: 'mcp.invalid-query',
            message: issue.message,
            severity: 'error' as const,
          })),
        });
      }
      const q = parsed.data;
      const needle = q.search?.toLowerCase();
      const matches = (options.media ?? [])
        .filter((m) => (q.type ? m.mimeType.startsWith(`${q.type}/`) : true))
        .filter((m) =>
          needle
            ? m.id.toLowerCase().includes(needle) || m.alt?.toLowerCase().includes(needle)
            : true,
        );
      const start = (q.page - 1) * MEDIA_PAGE_SIZE;
      return ok({
        items: clone(matches.slice(start, start + MEDIA_PAGE_SIZE)),
        page: q.page,
        totalPages: Math.ceil(matches.length / MEDIA_PAGE_SIZE),
      });
    },

    async previewUrl(ref, locale) {
      const found = find(ref);
      if (!found.ok) return found;
      const path = found.value.previewPath;
      if (path === null) return ok(null);
      const url = `${options.previewBaseUrl?.replace(/\/+$/, '') ?? ''}${path}`;
      return ok(
        locale ? `${url}${url.includes('?') ? '&' : '?'}locale=${encodeURIComponent(locale)}` : url,
      );
    },
  };
}
