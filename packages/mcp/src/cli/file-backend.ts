import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import {
  type BuilderDocument,
  fromManifest,
  parseDocument,
  type RegistryManifest,
} from '@buildr/core';
import type { McpBackend } from '../backend.ts';
import { createMemoryBackend, type MemoryDocumentInput } from '../backends/memory.ts';

const DEFAULT_COLLECTION = 'pages';
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The committed catalogue of the built-in components (`fixtures/`, shipped in `files`). */
export function loadDefaultManifest(): RegistryManifest {
  // The same relative path works from `src/cli` and from `dist/cli`.
  const url = new URL('../../fixtures/default-manifest.json', import.meta.url);
  const parsed = fromManifest(JSON.parse(readFileSync(url, 'utf8')));
  if (!parsed.ok) throw new Error(`default-manifest.json is invalid: ${parsed.error[0]?.message}`);
  return parsed.value;
}

interface StoredFile {
  readonly title?: unknown;
  readonly slug?: unknown;
  readonly status?: unknown;
  readonly revision?: unknown;
  readonly document?: unknown;
}

function readDocuments(dir: string, warn: (message: string) => void): MemoryDocumentInput[] {
  const out: MemoryDocumentInput[] = [];
  const readFile = (collection: string, file: string): void => {
    const id = basename(file, '.json');
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as StoredFile;
      // Either a wrapper `{ title, slug, status, revision, document }` or a bare document.
      const wrapped = raw !== null && typeof raw === 'object' && 'document' in raw;
      const parsed = parseDocument(wrapped ? raw.document : raw);
      if (!parsed.ok) throw new Error(parsed.error[0]?.message ?? 'not a valid document');
      const document: BuilderDocument = parsed.value;
      out.push({
        ref: { collection, id },
        title: wrapped && typeof raw.title === 'string' ? raw.title : id,
        slug: wrapped && typeof raw.slug === 'string' ? raw.slug : id,
        status: wrapped && raw.status === 'published' ? 'published' : 'draft',
        revision: wrapped && typeof raw.revision === 'number' ? raw.revision : 0,
        document,
      });
    } catch (error) {
      warn(`skipping ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && extname(entry.name) === '.json') {
      readFile(DEFAULT_COLLECTION, join(dir, entry.name));
    } else if (entry.isDirectory() && SAFE_NAME.test(entry.name)) {
      for (const inner of readdirSync(join(dir, entry.name), { withFileTypes: true })) {
        if (inner.isFile() && extname(inner.name) === '.json') {
          readFile(entry.name, join(dir, entry.name, inner.name));
        }
      }
    }
  }
  return out;
}

export interface FileBackendOptions {
  readonly dir: string;
  readonly manifest?: RegistryManifest;
  readonly warn?: (message: string) => void;
}

/**
 * The playground backend: the memory backend seeded from the JSON files of `dir`, writing every
 * created, saved or published document back to its file (`<collection>/<id>.json`). Only ids that
 * are safe file names are written, so nothing outside `dir` is ever touched.
 */
export function createFileBackend(options: FileBackendOptions): McpBackend {
  const dir = resolve(options.dir);
  const manifest = options.manifest ?? loadDefaultManifest();
  const documents = readDocuments(dir, options.warn ?? (() => {}));
  const inner = createMemoryBackend({ manifest, documents, collections: [DEFAULT_COLLECTION] });

  async function persist(collection: string, id: string | number): Promise<void> {
    const name = String(id);
    if (!SAFE_NAME.test(collection) || !SAFE_NAME.test(name)) return;
    const loaded = await inner.load({ collection, id });
    if (!loaded.ok) return;
    const target = collection === DEFAULT_COLLECTION ? dir : join(dir, collection);
    mkdirSync(target, { recursive: true });
    const file = join(target, `${name}.json`);
    const tmp = `${file}.tmp`;
    const { title, slug, status, revision, document } = loaded.value;
    writeFileSync(tmp, `${JSON.stringify({ title, slug, status, revision, document }, null, 2)}\n`);
    renameSync(tmp, file);
  }

  return {
    ...inner,
    async createDocument(input) {
      const result = await inner.createDocument(input);
      if (result.ok) await persist(result.value.ref.collection, result.value.ref.id);
      return result;
    },
    async save(ref, doc, baseRevision) {
      const result = await inner.save(ref, doc, baseRevision);
      if (result.ok) await persist(ref.collection, ref.id);
      return result;
    },
    async publish(ref, baseRevision) {
      const result = await inner.publish(ref, baseRevision);
      if (result.ok) await persist(ref.collection, ref.id);
      return result;
    },
  };
}
