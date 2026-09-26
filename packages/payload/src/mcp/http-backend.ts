import {
  type Diagnostic,
  defaultTheme,
  fromManifest,
  ok,
  parseDocument,
  type Theme,
} from '@next-buildr/core';
import {
  type CreateDocumentInput,
  createDocumentInputSchema,
  type DocumentRef,
  type DocumentSummary,
  type ListDocumentsQuery,
  type ListDocumentsResult,
  type ListMediaQuery,
  type LoadedDocument,
  listDocumentsQuerySchema,
  listMediaQuerySchema,
  type McpBackend,
  type McpResult,
  mcpFail,
  sessionSchema,
} from '@next-buildr/mcp';
import type { z } from 'zod';
import {
  type DocumentSummary as ContractSummary,
  conflictResponseSchema,
  createDocumentResponseSchema,
  DOCUMENT_LIST_PAGE_SIZE,
  dataSchemaResponseSchema,
  documentListResponseSchema,
  documentResponseSchema,
  errorResponseSchema,
  invalidResponseSchema,
  mediaListResponseSchema,
  publishResponseSchema,
  saveResponseSchema,
  sessionResponseSchema,
} from '../contract.ts';

export interface PayloadMcpBackendOptions {
  /** Payload's API root of the site, e.g. `https://example.com/api`. */
  readonly baseUrl: string;
  /** A Payload API key of a dedicated, low-privilege user. It is only ever sent as a header. */
  readonly apiKey: string;
  /** The auth collection the key belongs to (default `users`). */
  readonly collection?: string;
  /**
   * The builder collections to list when `listDocuments` is called without a `collection`
   * (the API has no collection index). Without it such a call is refused as `invalid`.
   */
  readonly collections?: readonly string[];
  /** The theme of the site; the builder API does not serve one, so the default theme unless set. */
  readonly theme?: Theme;
  /** Origin that `previewUrl` prefixes to the document's public path (default: the origin of `baseUrl`). */
  readonly siteUrl?: string;
  /** Per-request timeout (default 15 s). */
  readonly timeoutMs?: number;
  /** Retries of idempotent requests (GET) after a network error, 429, 502, 503 or 504 (default 2). */
  readonly retries?: number;
  /** Defaults to the global `fetch` (looked up per call). */
  readonly fetch?: typeof globalThis.fetch;
  /** Waits between retries; injectable for tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

interface Reply {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfter: number | undefined;
}

interface RequestInit {
  readonly query?: Record<string, string | undefined> | undefined;
  readonly body?: unknown;
}

const MAX_GATHER_PAGES = 25;
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const seg = (value: string | number): string => encodeURIComponent(String(value));
const documentPath = (ref: DocumentRef): string =>
  `/buildr/documents/${seg(ref.collection)}/${seg(ref.id)}`;

const diagnostic = (message: string): Diagnostic => ({
  code: 'mcp.invalid-input',
  message,
  severity: 'error',
});

/** Diagnostics for input a Zod schema refused. */
const zodDiagnostics = (error: z.ZodError): Diagnostic[] =>
  error.issues.map((issue) => ({
    code: 'mcp.invalid-input',
    message: issue.message,
    severity: 'error' as const,
    path: issue.path.filter((part): part is string | number => typeof part !== 'symbol'),
  }));

const invalid = (message: string, diagnostics: readonly Diagnostic[] = [diagnostic(message)]) =>
  mcpFail({ code: 'invalid', message, diagnostics });

/**
 * The `McpBackend` of `@next-buildr/mcp` over the builder API of a site running the Payload plugin
 * (docs/mcp.md#http-backend). Authenticates with a Payload API key; every response is checked
 * against the contract and documents with `parseDocument`. Only GETs are retried. The API key is
 * sent as a header only and is scrubbed from every message this backend produces.
 */
export function createPayloadMcpBackend(options: PayloadMcpBackendOptions): McpBackend {
  const base = options.baseUrl.replace(/\/+$/, '');
  const authHeader = `${options.collection ?? 'users'} API-Key ${options.apiKey}`;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const retries = options.retries ?? 2;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const theme = options.theme ?? defaultTheme;
  const siteOrigin = (() => {
    try {
      return (options.siteUrl ?? new URL(base).origin).replace(/\/+$/, '');
    } catch {
      return '';
    }
  })();

  /** Every message that leaves this module passes here: the key must never show up in one. */
  const redact = (text: string): string =>
    options.apiKey === '' ? text : text.split(options.apiKey).join('***');

  const network = (message: string, retryable: boolean) =>
    mcpFail({ code: 'network', message: redact(message), retryable });

  async function attempt(
    method: string,
    path: string,
    init: RequestInit,
  ): Promise<Reply | undefined> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined) params.set(key, value);
    }
    const search = params.toString();
    const url = `${base}${path}${search === '' ? '' : `?${search}`}`;
    try {
      const doFetch = options.fetch ?? globalThis.fetch;
      const response = await doFetch(url, {
        method,
        headers: {
          authorization: authHeader,
          accept: 'application/json',
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text().catch(() => '');
      let body: unknown;
      if (text !== '') {
        try {
          body = JSON.parse(text);
        } catch {
          body = undefined;
        }
      }
      const retryAfter = Number(response.headers.get('retry-after'));
      return {
        status: response.status,
        body,
        retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
      };
    } catch {
      // The cause is dropped on purpose: it is not needed to act on and could echo request details.
      return undefined;
    }
  }

  /** Sends a request; only GETs are retried. `undefined` means the server never answered. */
  async function send(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    init: RequestInit = {},
  ): Promise<Reply | undefined> {
    const maxRetries = method === 'GET' ? retries : 0;
    for (let n = 0; ; n += 1) {
      const reply = await attempt(method, path, init);
      const retryable = reply === undefined || RETRY_STATUSES.has(reply.status);
      if (!retryable || n >= maxRetries) return reply;
      const hinted = reply?.retryAfter;
      await sleep(Math.min(hinted === undefined ? 200 * 2 ** n : hinted * 1000, 5_000));
    }
  }

  const messageOf = (reply: Reply, fallback: string): string => {
    const parsed = errorResponseSchema.safeParse(reply.body);
    return redact(parsed.success ? parsed.data.error : fallback);
  };

  /** The failure of a reply that is not the success the caller expects. */
  function refusal(reply: Reply | undefined, what: string) {
    if (reply === undefined) return network(`The site could not be reached (${what}).`, true);
    switch (reply.status) {
      case 401:
        return mcpFail({
          code: 'forbidden' as const,
          message:
            'The API key was not accepted. Check the key and that its user has API access enabled.',
        });
      case 403:
        return mcpFail({
          code: 'forbidden' as const,
          message: messageOf(reply, 'This user may not do that.'),
        });
      case 404:
        return mcpFail({
          code: 'not-found' as const,
          message: messageOf(reply, `Not found (${what}).`),
        });
      case 409: {
        const parsed = conflictResponseSchema.safeParse(reply.body);
        if (parsed.success) {
          return mcpFail({
            code: 'conflict' as const,
            message: `The document was changed by somebody else; it is now at revision ${parsed.data.currentRevision}. Reload it and re-apply your changes.`,
            currentRevision: parsed.data.currentRevision,
          });
        }
        return network('The site reported a conflict without a revision.', false);
      }
      case 400:
        return invalid(messageOf(reply, 'The request was not valid.'));
      case 422: {
        const parsed = invalidResponseSchema.safeParse(reply.body);
        if (parsed.success && parsed.data.diagnostics.length > 0) {
          return invalid(
            redact(parsed.data.diagnostics[0]?.message ?? 'The document is not valid.'),
            parsed.data.diagnostics.map((d) => ({
              ...d,
              message: redact(d.message),
            })) as Diagnostic[],
          );
        }
        return invalid(messageOf(reply, 'The document is not valid.'));
      }
      case 429:
        return network(
          `Too many requests${reply.retryAfter === undefined ? '' : `; retry in ${reply.retryAfter} s`}.`,
          true,
        );
      default:
        return network(`The site answered ${reply.status} (${what}).`, reply.status >= 500);
    }
  }

  /** The body of `reply` when it has `status` and matches `schema`, else a failure. */
  function expectBody<S extends z.ZodType>(
    reply: Reply | undefined,
    schema: S,
    what: string,
    status = 200,
  ): McpResult<z.infer<S>> {
    if (reply === undefined || reply.status !== status) return refusal(reply, what);
    const parsed = schema.safeParse(reply.body);
    if (!parsed.success) {
      return network(`The site's answer does not match the builder contract (${what}).`, false);
    }
    return ok(parsed.data);
  }

  const summaryOf = (doc: ContractSummary): DocumentSummary => ({
    ref: doc.ref,
    title: doc.title,
    slug: doc.slug,
    status: doc.status,
    updatedAt: doc.updatedAt,
    revision: doc.revision,
  });

  /** One server page (20 documents) of one collection. */
  async function fetchPage(collection: string, search: string | undefined, page: number) {
    const reply = await send('GET', '/buildr/documents', {
      query: { collection, search, page: String(page) },
    });
    return expectBody(reply, documentListResponseSchema, 'listing documents');
  }

  async function listDocuments(
    input?: ListDocumentsQuery,
  ): Promise<McpResult<ListDocumentsResult>> {
    const query = listDocumentsQuerySchema.safeParse(input ?? {});
    if (!query.success) return invalid('The query is not valid.', zodDiagnostics(query.error));
    const { collection, search, status, page, limit } = query.data;
    const collections = collection === undefined ? [...(options.collections ?? [])] : [collection];
    if (collections.length === 0) return invalid('Pass a collection to list documents from.');
    const start = (page - 1) * limit;
    const finish = (items: DocumentSummary[], total: number): McpResult<ListDocumentsResult> =>
      ok({ items, page, total, totalPages: Math.ceil(total / limit) });

    // A status filter or several collections need everything (capped); one collection is windowed.
    if (collections.length > 1 || status !== undefined) {
      const all: DocumentSummary[] = [];
      for (const name of collections) {
        for (let n = 1; n <= MAX_GATHER_PAGES; n += 1) {
          const result = await fetchPage(name, search, n);
          if (!result.ok) {
            if (result.error.code === 'not-found') break;
            return result;
          }
          all.push(...result.value.items.map(summaryOf));
          if (n >= result.value.totalPages) break;
        }
      }
      const filtered = (status === undefined ? all : all.filter((d) => d.status === status)).sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      );
      return finish(filtered.slice(start, start + limit), filtered.length);
    }

    const name = collections[0] as string;
    const first = Math.floor(start / DOCUMENT_LIST_PAGE_SIZE) + 1;
    const last = Math.floor((start + limit - 1) / DOCUMENT_LIST_PAGE_SIZE) + 1;
    const items: DocumentSummary[] = [];
    let totalPages = 0;
    let lastCount = 0;
    let lastSeen = 0;
    for (let n = first; n <= last; n += 1) {
      const result = await fetchPage(name, search, n);
      if (!result.ok) {
        // A collection the builder does not know has no documents.
        if (result.error.code === 'not-found') return finish([], 0);
        return result;
      }
      totalPages = result.value.totalPages;
      if (n > totalPages) break;
      items.push(...result.value.items.map(summaryOf));
      lastSeen = n;
      lastCount = result.value.items.length;
      if (n >= totalPages) break;
    }
    if (totalPages === 0) return finish([], 0);
    if (lastSeen !== totalPages) {
      // The exact total needs the size of the last server page.
      const tail = await fetchPage(name, search, totalPages);
      if (!tail.ok) return tail;
      lastCount = tail.value.items.length;
    }
    const total = (totalPages - 1) * DOCUMENT_LIST_PAGE_SIZE + lastCount;
    const offset = start - (first - 1) * DOCUMENT_LIST_PAGE_SIZE;
    return finish(items.slice(offset, offset + limit), total);
  }

  return {
    async getSession() {
      const reply = await send('GET', '/buildr/session');
      const body = expectBody(reply, sessionResponseSchema, 'reading the session');
      if (!body.ok) return body;
      const parsed = sessionSchema.safeParse(body.value);
      if (!parsed.success) {
        return network('The session does not match the builder contract.', false);
      }
      return ok(parsed.data);
    },

    async getManifest() {
      const reply = await send('GET', '/buildr/manifest');
      if (reply === undefined || reply.status !== 200) {
        return refusal(reply, 'reading the manifest');
      }
      const manifest = fromManifest(reply.body);
      if (!manifest.ok) return network('The manifest does not match the builder contract.', false);
      return ok(manifest.value);
    },

    async getTheme() {
      return ok(theme);
    },

    listDocuments,

    async createDocument(input: CreateDocumentInput) {
      const parsed = createDocumentInputSchema.safeParse(input);
      if (!parsed.success) return invalid('The input is not valid.', zodDiagnostics(parsed.error));
      const reply = await send('POST', '/buildr/documents', { body: parsed.data });
      const body = expectBody(reply, createDocumentResponseSchema, 'creating a document', 201);
      return body.ok ? ok(summaryOf(body.value)) : body;
    },

    async load(ref, loadOptions): Promise<McpResult<LoadedDocument>> {
      const reply = await send('GET', documentPath(ref), {
        query: { draft: '1', locale: loadOptions?.locale },
      });
      const body = expectBody(reply, documentResponseSchema, 'loading the document');
      if (!body.ok) return body;
      const doc = parseDocument(body.value.document);
      if (!doc.ok) return invalid('The stored document is not valid.', doc.error);
      const { document: _raw, ...rest } = body.value;
      const { readOnly, ...fields } = rest;
      return ok({
        ...fields,
        document: doc.value,
        ...(readOnly === undefined ? {} : { readOnly }),
      });
    },

    async save(ref, doc, baseRevision) {
      const parsed = parseDocument(doc);
      if (!parsed.ok) return invalid('The document is not valid.', parsed.error);
      const reply = await send('PUT', documentPath(ref), {
        body: { document: parsed.value, baseRevision, autosave: false },
      });
      return expectBody(reply, saveResponseSchema, 'saving the document');
    },

    async publish(ref, baseRevision) {
      const reply = await send('POST', `${documentPath(ref)}/publish`, { body: { baseRevision } });
      return expectBody(reply, publishResponseSchema, 'publishing the document');
    },

    async getDataSchema(collection) {
      const reply = await send('GET', `/buildr/data-schema/${seg(collection)}`);
      return expectBody(reply, dataSchemaResponseSchema, 'reading the data schema');
    },

    async listMedia(input?: ListMediaQuery) {
      const query = listMediaQuerySchema.safeParse(input ?? {});
      if (!query.success) return invalid('The query is not valid.', zodDiagnostics(query.error));
      const reply = await send('GET', '/buildr/media', {
        query: {
          search: query.data.search === '' ? undefined : query.data.search,
          type: query.data.type,
          page: String(query.data.page),
        },
      });
      // A site without a media collection has no media.
      if (reply?.status === 404) return ok({ items: [], page: query.data.page, totalPages: 0 });
      return expectBody(reply, mediaListResponseSchema, 'listing media');
    },

    async previewUrl(ref) {
      const reply = await send('GET', documentPath(ref), { query: { draft: '1' } });
      const body = expectBody(reply, documentResponseSchema, 'resolving the preview');
      if (!body.ok) return body;
      const path = body.value.previewPath;
      return ok(path === null ? null : `${siteOrigin}${path}`);
    },
  };
}
