import { templateSampleScopes } from '@next-buildr/components';
import { type BuilderDocument, type DataContext, type LocaleConfig, s } from '@next-buildr/core';
import type { DocumentAdapter, DocumentRef } from '@next-buildr/editor';
import { doc } from '@next-buildr/test-utils';

export const PLAYGROUND_LOCALES: LocaleConfig = {
  locales: ['en', 'pl'],
  default: 'en',
  fallback: true,
  intl: { en: 'English', pl: 'Polski' },
};

/** The samples a template can be previewed against; the canvas and the editor share them. */
export const SAMPLES = [
  { id: 'post', label: 'Sample post' },
  { id: 'product', label: 'Sample product' },
] as const;

const POLISH: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  post: { title: 'Budowanie stron z danych' },
  product: { title: 'Lampka biurkowa', shortDescription: 'Lampka, która oświetla biurko.' },
};

/** The scopes of one sample in one language; what the canvas renders the document against. */
export function sampleScopes(sampleId: string | null, locale: string): DataContext['scopes'] {
  const scopes = templateSampleScopes as Record<string, Record<string, unknown>>;
  const chosen = sampleId !== null && Object.hasOwn(scopes, sampleId) ? sampleId : 'post';
  const base = scopes[chosen] ?? {};
  const translated = locale === 'pl' ? { ...base, ...POLISH[chosen] } : base;
  return { ...templateSampleScopes, [chosen]: translated } as DataContext['scopes'];
}

export const initialDocument = (): BuilderDocument =>
  doc({
    children: [
      {
        type: 'buildr/section',
        children: [
          { type: 'buildr/heading', props: { text: s('Welcome to Buildr'), level: s(1) } },
          { type: 'buildr/text', props: { text: s('Edit this page in the playground.') } },
        ],
      },
    ],
  });

interface Stored {
  readonly revision: number;
  readonly title: string;
  readonly document: unknown;
  readonly publishedRevision: number | undefined;
}

const storageKey = (ref: DocumentRef) => `buildr:playground:${ref.collection}:${ref.id}`;

export interface MemoryAdapterOptions {
  /** Where documents are kept; `localStorage` unless a test gives another. */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  readonly initial?: () => BuilderDocument;
  readonly title?: string;
}

/**
 * A `DocumentAdapter` with no backend: the document lives in `localStorage` (every access is
 * guarded, so a blocked storage only means nothing is remembered) and in memory. The playground's
 * proof that the editor needs neither Payload nor Next.js.
 */
export function createMemoryAdapter(options: MemoryAdapterOptions = {}): DocumentAdapter {
  const memory = new Map<string, Stored>();
  const storage = (): Pick<Storage, 'getItem' | 'setItem'> | undefined => {
    try {
      return options.storage ?? globalThis.localStorage;
    } catch {
      return undefined;
    }
  };
  const read = (ref: DocumentRef): Stored | undefined => {
    const key = storageKey(ref);
    try {
      const raw = storage()?.getItem(key);
      if (raw !== null && raw !== undefined) return JSON.parse(raw) as Stored;
    } catch {
      // Unreadable or blocked: fall back to what this session holds.
    }
    return memory.get(key);
  };
  const write = (ref: DocumentRef, value: Stored) => {
    const key = storageKey(ref);
    memory.set(key, value);
    try {
      storage()?.setItem(key, JSON.stringify(value));
    } catch {
      // Private windows and quota errors: the document stays in memory.
    }
  };
  const now = () => new Date().toISOString();
  /** The first revision: kept at once, so it can be published before anything is edited. */
  const seed = (ref: DocumentRef): Stored => {
    const initial: Stored = {
      revision: 1,
      title: options.title ?? 'Playground page',
      document: (options.initial ?? initialDocument)(),
      publishedRevision: undefined,
    };
    write(ref, initial);
    return initial;
  };

  return {
    getSession: async () => ({ canEdit: true, canPublish: true, locales: PLAYGROUND_LOCALES }),
    async load(ref) {
      const stored = read(ref) ?? seed(ref);
      return {
        title: stored.title,
        status: stored.publishedRevision === stored.revision ? 'published' : 'draft',
        updatedAt: now(),
        revision: stored.revision,
        document: stored.document as BuilderDocument,
      };
    },
    async save(ref, { document, baseRevision }) {
      const current = read(ref);
      const revision = current?.revision ?? 1;
      if (baseRevision !== revision) {
        return { ok: false, kind: 'conflict', currentRevision: revision };
      }
      write(ref, {
        revision: revision + 1,
        title: current?.title ?? options.title ?? 'Playground page',
        document,
        publishedRevision: current?.publishedRevision,
      });
      return { ok: true, revision: revision + 1, updatedAt: now() };
    },
    async publish(ref, { baseRevision }) {
      const current = read(ref);
      if (current === undefined || current.revision !== baseRevision) {
        return { ok: false, kind: 'conflict', currentRevision: current?.revision ?? 1 };
      }
      write(ref, { ...current, publishedRevision: current.revision });
      return { ok: true, revision: current.revision, updatedAt: now() };
    },
    getDataSchema: async () => ({ scopes: {}, entities: {} }),
    getContext: async (_ref, opts) => ({
      scopes: sampleScopes(opts?.sampleId ?? null, PLAYGROUND_LOCALES.default),
      locale: PLAYGROUND_LOCALES.default,
      locales: { default: 'en', fallback: true, intl: { ...PLAYGROUND_LOCALES.intl } },
      timeZone: 'UTC',
      mode: 'preview',
    }),
    listSamples: async () => SAMPLES,
    media: { search: async () => ({ items: [] }) },
    previewUrl: (ref) => `/gallery?fixture=hello&ref=${encodeURIComponent(ref.id)}`,
  };
}
