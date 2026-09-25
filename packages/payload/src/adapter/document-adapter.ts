import {
  type DataContext,
  type DataSchema,
  type Diagnostic,
  type JsonValue,
  type LocaleConfig,
  mediaAssetSchema,
  parseDocument,
} from '@buildr/core';
import type {
  DocumentAdapter,
  DocumentRef,
  EditorSession,
  LoadedDocument,
  PublishResult,
  RevisionInfo,
  SaveResult,
} from '@buildr/editor';
import {
  conflictResponseSchema,
  dataContextResponseSchema,
  dataSchemaResponseSchema,
  documentResponseSchema,
  invalidResponseSchema,
  mediaListResponseSchema,
  publishResponseSchema,
  revisionResponseSchema,
  type SessionResponse,
  samplesResponseSchema,
  saveResponseSchema,
  sessionResponseSchema,
} from '../contract.ts';
import {
  AdapterError,
  createHttp,
  errorOf,
  expectBody,
  type HttpOptions,
  type Reply,
} from './http.ts';

export interface PayloadAdapterOptions extends HttpOptions {
  /** The language the editor is showing now; defaults to the site's default language. */
  readonly locale?: (() => string | undefined) | undefined;
  /** The IANA time zone of the site's dates (default: the browser's). */
  readonly timeZone?: string | undefined;
  /** The route the site uses to open a draft (`routes.preview` of the plugin; default `/buildr/preview`). */
  readonly previewRoute?: string | undefined;
  /** Payload's admin route (default `/admin`); `cmsUrl` links into it. */
  readonly adminRoute?: string | undefined;
}

const seg = (value: string | number): string => encodeURIComponent(String(value));
const documentPath = (ref: DocumentRef): string =>
  `/buildr/documents/${seg(ref.collection)}/${seg(ref.id)}`;

/** The server's diagnostics as core's (`details` is JSON on the wire). */
const diagnosticsOf = (
  list: readonly { code: string; message: string; severity: 'error' | 'warning' }[],
): readonly Diagnostic[] => list as unknown as readonly Diagnostic[];

/** A `409` or `422` of a save/publish is a value; anything else that is not `200` rejects. */
function refusal(reply: Reply): Extract<SaveResult, { ok: false }> | undefined {
  if (reply.status === 409) {
    const parsed = conflictResponseSchema.safeParse(reply.body);
    if (parsed.success) {
      return { ok: false, kind: 'conflict', currentRevision: parsed.data.currentRevision };
    }
  }
  if (reply.status === 422) {
    const parsed = invalidResponseSchema.safeParse(reply.body);
    if (parsed.success) {
      return { ok: false, kind: 'invalid', diagnostics: diagnosticsOf(parsed.data.diagnostics) };
    }
  }
  return undefined;
}

const MIME_TYPES = ['image', 'video', 'audio'] as const;

/** The one media type all of `mimeTypes` share (`image/*`, `image/png`, ...), if there is one. */
function mediaType(
  mimeTypes: readonly string[] | undefined,
): (typeof MIME_TYPES)[number] | undefined {
  if (mimeTypes === undefined || mimeTypes.length === 0) return undefined;
  const kinds = new Set(mimeTypes.map((mime) => mime.split('/')[0]));
  const [only] = [...kinds];
  return kinds.size === 1 ? MIME_TYPES.find((kind) => kind === only) : undefined;
}

/**
 * The `DocumentAdapter` of the editor (docs/editor.md#persistence-pb-087) over the builder API of
 * the Payload plugin. Responses are checked against the contract; a document is parsed with core's
 * `parseDocument`. A refused save (`409`, `422`) is a result; anything the adapter could not tell
 * (no network, `5xx`, `401`, `403`, `404`) rejects with an `AdapterError`, which the editor retries.
 */
export function createPayloadAdapter(options: PayloadAdapterOptions): DocumentAdapter {
  const http = createHttp(options);
  let session: Promise<SessionResponse> | undefined;

  const loadSession = (): Promise<SessionResponse> => {
    session ??= http
      .send('GET', '/buildr/session')
      .then((reply) => expectBody(reply, sessionResponseSchema))
      .catch((error: unknown) => {
        session = undefined;
        throw error;
      });
    return session;
  };

  const localesOf = (current: SessionResponse): LocaleConfig | undefined =>
    current.locales === undefined ? undefined : current.locales;

  return {
    async getSession(): Promise<EditorSession> {
      const current = await loadSession();
      const locales = localesOf(current);
      return {
        userId: String(current.user.id),
        canEdit: current.permissions.canEdit,
        canPublish: current.permissions.canPublish,
        ...(locales === undefined ? {} : { locales }),
      };
    },

    async load(ref): Promise<LoadedDocument> {
      const reply = await http.send('GET', documentPath(ref), {
        query: { draft: '1', locale: options.locale?.() },
      });
      const body = expectBody(reply, documentResponseSchema);
      const parsed = parseDocument(body.document);
      if (!parsed.ok) throw new AdapterError('The stored document is not valid.', reply.status);
      return {
        title: body.title,
        ...(body.slug === null ? {} : { slug: body.slug }),
        status: body.status,
        updatedAt: body.updatedAt,
        revision: body.revision,
        document: parsed.value,
        contextRef: body.contextRef,
        ...(body.readOnly === true ? { readOnly: true } : {}),
      };
    },

    async getRevision(ref): Promise<RevisionInfo> {
      const reply = await http.send('GET', `${documentPath(ref)}/revision`);
      const body = expectBody(reply, revisionResponseSchema);
      return {
        revision: body.revision,
        updatedAt: body.updatedAt,
        ...(body.updatedBy === undefined ? {} : { updatedBy: body.updatedBy }),
      };
    },

    async save(ref, request): Promise<SaveResult> {
      const reply = await http.send('PUT', documentPath(ref), { body: request });
      const refused = refusal(reply);
      if (refused !== undefined) return refused;
      const body = expectBody(reply, saveResponseSchema);
      return { ok: true, revision: body.revision, updatedAt: body.updatedAt };
    },

    async publish(ref, request): Promise<PublishResult> {
      const reply = await http.send('POST', `${documentPath(ref)}/publish`, { body: request });
      const refused = refusal(reply);
      if (refused !== undefined) return refused;
      const body = expectBody(reply, publishResponseSchema);
      return { ok: true, revision: body.revision, updatedAt: body.updatedAt };
    },

    async getDataSchema(ref): Promise<DataSchema> {
      const reply = await http.send('GET', `/buildr/data-schema/${seg(ref.collection)}`);
      return expectBody(reply, dataSchemaResponseSchema);
    },

    async getContext(ref, request): Promise<DataContext> {
      const current = await loadSession();
      const locales = localesOf(current);
      const locale = options.locale?.() ?? locales?.default ?? 'en';
      // A sample is `collection:id` (what `listSamples` returns); a bare id belongs to the document's own collection.
      const sample = request?.sampleId;
      const at = sample === undefined ? -1 : sample.indexOf(':');
      const reply = await http.send('GET', '/buildr/data/context', {
        query: {
          collection: sample !== undefined && at > 0 ? sample.slice(0, at) : ref.collection,
          id: sample === undefined ? String(ref.id) : sample.slice(at + 1),
          draft: '1',
          locale,
        },
      });
      const body = expectBody(reply, dataContextResponseSchema);
      const fallbackLocales = { default: locale, fallback: false, intl: { [locale]: locale } };
      return {
        scopes: body.scopes as Readonly<Record<string, JsonValue>>,
        locale,
        locales: locales ?? fallbackLocales,
        timeZone: options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        mode: 'canvas',
      };
    },

    async listSamples(ref) {
      const reply = await http.send('GET', `/buildr/samples/${seg(ref.collection)}`);
      const body = expectBody(reply, samplesResponseSchema);
      // The id is the canvas's `contextRef` (`collection:id`), so choosing a sample needs no translation.
      return body.items.map((item) => ({ id: `${ref.collection}:${item.id}`, label: item.title }));
    },

    media: {
      async search(query) {
        const page = query.cursor === undefined ? 1 : Number(query.cursor);
        const reply = await http.send('GET', '/buildr/media', {
          query: {
            search: query.text === undefined || query.text === '' ? undefined : query.text,
            type: mediaType(query.mimeTypes),
            page: String(Number.isInteger(page) && page >= 1 ? page : 1),
          },
        });
        const body = expectBody(reply, mediaListResponseSchema);
        return {
          items: body.items,
          ...(body.page < body.totalPages ? { nextCursor: String(body.page + 1) } : {}),
        };
      },
      async upload(file, alt) {
        const form = new FormData();
        form.set('file', file);
        form.set('alt', alt);
        const reply = await http.send('POST', '/buildr/media', { body: form });
        if (reply.status === 422) throw errorOf(reply);
        return expectBody(reply, mediaAssetSchema, [201]);
      },
    },

    previewUrl(ref, request) {
      const query = new URLSearchParams({ collection: ref.collection, id: String(ref.id) });
      if (request?.draft === true) query.set('draft', '1');
      return `${options.previewRoute ?? '/buildr/preview'}?${query.toString()}`;
    },

    cmsUrl(ref) {
      return `${(options.adminRoute ?? '/admin').replace(/\/+$/, '')}/collections/${seg(ref.collection)}/${seg(ref.id)}`;
    },
  };
}
