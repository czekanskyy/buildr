import { templateSampleScopes } from '@next-buildr/components';
import {
  type BuilderDocument,
  type DataContext,
  type LocaleConfig,
  type MediaAsset,
  registryVersions,
  s,
} from '@next-buildr/core';
import type { DocumentAdapter, DocumentRef } from '@next-buildr/editor';
import { doc } from '@next-buildr/test-utils';
import { previewHref, previewStorageKey } from './preview-route.ts';
import { registry } from './registry.ts';

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
  doc(
    {
      children: [
        {
          type: 'buildr/container',
          props: { as: s('section'), display: s('flex'), width: s('lg'), bleed: s(true) },
          styles: { base: { layout: { gap: '0' } } },
          children: [
            { type: 'buildr/heading', props: { text: s('Welcome to Buildr'), level: s(1) } },
            { type: 'buildr/text', props: { text: s('Edit this page in the playground.') } },
          ],
        },
      ],
    },
    { versions: registryVersions(registry.meta) },
  );

interface Stored {
  readonly revision: number;
  readonly title: string;
  readonly document: unknown;
  readonly publishedRevision: number | undefined;
}

const storageKey = (ref: DocumentRef) => `buildr:playground:${ref.collection}:${ref.id}`;

const svg = (fill: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${fill}"/><text x="320" y="190" font-size="32" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>`,
  )}`;

/**
 * A small media library for trying the pickers: two images, two posters and two videos. The video
 * files are placeholders (the playground ships no binaries); the picker, the stored references and
 * the poster images work as they do with a real library.
 */
export const DEMO_MEDIA: readonly MediaAsset[] = [
  {
    id: 'demo-image-1',
    url: svg('#2f6fed', 'Image 1'),
    alt: 'Blue demo image',
    width: 640,
    height: 360,
    mimeType: 'image/svg+xml',
  },
  {
    id: 'demo-image-2',
    url: svg('#1f8a5b', 'Image 2'),
    alt: 'Green demo image',
    width: 640,
    height: 360,
    mimeType: 'image/svg+xml',
  },
  {
    id: 'demo-poster-1',
    url: svg('#7a3fd1', 'Poster 1'),
    alt: 'Demo poster, violet',
    width: 640,
    height: 360,
    mimeType: 'image/svg+xml',
  },
  {
    id: 'demo-poster-2',
    url: svg('#c2410c', 'Poster 2'),
    alt: 'Demo poster, orange',
    width: 640,
    height: 360,
    mimeType: 'image/svg+xml',
  },
  {
    id: 'demo-video-1',
    url: '/media/demo-clip-1.mp4',
    alt: 'Demo clip 1',
    width: 1280,
    height: 720,
    mimeType: 'video/mp4',
  },
  {
    id: 'demo-video-2',
    url: '/media/demo-clip-2.webm',
    alt: 'Demo clip 2',
    width: 1280,
    height: 720,
    mimeType: 'video/webm',
  },
];

const mimeMatches = (pattern: string, mimeType: string) =>
  pattern.endsWith('/*') ? mimeType.startsWith(pattern.slice(0, -1)) : pattern === mimeType;

export interface MemoryAdapterOptions {
  /** Media the library offers; none unless given (the seeded visual runs keep an empty library). */
  readonly media?: readonly MediaAsset[] | undefined;
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
    async rename(ref, title) {
      const current = read(ref) ?? seed(ref);
      const next = title.trim();
      if (next === '') throw new Error('The page name cannot be empty.');
      write(ref, { ...current, title: next });
      return { title: next };
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
    media: {
      search: async ({ text, mimeTypes }) => ({
        items: (options.media ?? []).filter(
          (asset) =>
            (mimeTypes === undefined || mimeTypes.some((m) => mimeMatches(m, asset.mimeType))) &&
            (text === undefined ||
              `${asset.alt ?? ''} ${asset.id}`.toLowerCase().includes(text.toLowerCase())),
        ),
      }),
    },
    previewUrl(ref) {
      // preparePreview saves pending edits before this call. Copy the adapter's current
      // document across the iframe boundary, including sessions with storage disabled.
      const current = memory.get(storageKey(ref)) ?? read(ref);
      try {
        globalThis.sessionStorage.removeItem(previewStorageKey(ref));
        if (current !== undefined) {
          globalThis.sessionStorage.setItem(
            previewStorageKey(ref),
            JSON.stringify(current.document),
          );
        }
      } catch {
        // The preview reports unavailable when browser storage is blocked.
      }
      return previewHref(ref);
    },
  };
}
