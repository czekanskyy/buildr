import {
  dataSchemaSchema,
  fromManifest,
  mediaAssetSchema,
  parseDocument,
  validateTheme,
} from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import {
  type DocumentRef,
  documentSummarySchema,
  listDocumentsResultSchema,
  type McpBackend,
  type McpResult,
  publishResultSchema,
  saveResultSchema,
  sessionSchema,
} from '../backend.ts';

/** What a backend under test provides; a fresh subject is created for every test. */
export interface BackendContractSubject {
  readonly backend: McpBackend;
  /** An editable draft the backend can load, save and publish. */
  readonly existing: DocumentRef;
  /** A reference no document has. */
  readonly missing: DocumentRef;
  /** A collection `createDocument` accepts. */
  readonly collection: string;
  /** A collection that does not exist. */
  readonly unknownCollection: string;
  /** A collection with a data schema, and one without. */
  readonly dataSchemaCollection: string;
  readonly noDataSchemaCollection: string;
  /** The same store seen by a user who may not edit; enables the `forbidden` save tests. */
  readonly readOnlyBackend?: McpBackend;
  /** The same store seen by a user who may edit but not publish. */
  readonly noPublishBackend?: McpBackend;
}

export interface BackendContractOptions {
  readonly name: string;
  readonly create: () => Promise<BackendContractSubject>;
}

function value<T>(result: McpResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function failure<T>(result: McpResult<T>) {
  if (result.ok) throw new Error('expected a failure, got ok');
  return result.error;
}

const sameRef = (a: DocumentRef, b: DocumentRef) =>
  a.collection === b.collection && String(a.id) === String(b.id);

/**
 * The reusable behavioural contract of an `McpBackend` (docs/mcp.md#backend-contract-tests). Run it
 * from a test file of the backend's own package: `runBackendContract({ name, create })`. It is the
 * definition of "a valid backend": the memory backend passes it, and so must the HTTP backend
 * (PB-140) and the local backend. Optional subject members (`readOnlyBackend`, `noPublishBackend`)
 * enable the permission tests; leave them out only when the backend cannot express the case.
 */
export function runBackendContract(options: BackendContractOptions): void {
  describe(`McpBackend contract: ${options.name}`, () => {
    describe('session, manifest, theme', () => {
      it('getSession returns a valid session', async () => {
        const { backend } = await options.create();
        const session = value(await backend.getSession());
        expect(sessionSchema.safeParse(session).success).toBe(true);
      });

      it('getManifest returns a valid manifest with components', async () => {
        const { backend } = await options.create();
        const manifest = value(await backend.getManifest());
        expect(fromManifest(manifest).ok).toBe(true);
        expect(Object.keys(manifest.components).length).toBeGreaterThan(0);
      });

      it('getTheme returns a valid theme', async () => {
        const { backend } = await options.create();
        expect(validateTheme(value(await backend.getTheme())).ok).toBe(true);
      });
    });

    describe('listDocuments / createDocument', () => {
      it('lists the existing document with a valid summary', async () => {
        const { backend, existing } = await options.create();
        const listing = value(await backend.listDocuments());
        expect(listDocumentsResultSchema.safeParse(listing).success).toBe(true);
        expect(listing.items.some((item) => sameRef(item.ref, existing))).toBe(true);
      });

      it('filters by collection and pages', async () => {
        const { backend, collection, unknownCollection } = await options.create();
        const other = value(await backend.listDocuments({ collection: unknownCollection }));
        expect(other.items).toEqual([]);
        expect(other.total).toBe(0);

        const first = value(await backend.listDocuments({ collection, limit: 1 }));
        expect(first.items.length).toBeLessThanOrEqual(1);
        const beyond = value(await backend.listDocuments({ collection, limit: 1, page: 1000 }));
        expect(beyond.items).toEqual([]);
      });

      it('rejects an invalid query as invalid', async () => {
        const { backend } = await options.create();
        expect(failure(await backend.listDocuments({ limit: 0 })).code).toBe('invalid');
      });

      it('creates a draft at revision 0 that shows up in the listing', async () => {
        const { backend, collection } = await options.create();
        const created = value(
          await backend.createDocument({
            collection,
            title: 'Contract page',
            slug: 'contract-page',
          }),
        );
        expect(documentSummarySchema.safeParse(created).success).toBe(true);
        expect(created.status).toBe('draft');
        expect(created.revision).toBe(0);
        expect(created.ref.collection).toBe(collection);
        const listing = value(await backend.listDocuments({ collection, limit: 100 }));
        expect(listing.items.some((item) => sameRef(item.ref, created.ref))).toBe(true);
        expect(value(await backend.load(created.ref)).title).toBe('Contract page');
      });

      it('refuses an unknown collection with not-found and bad input with invalid', async () => {
        const { backend, unknownCollection, collection } = await options.create();
        expect(
          failure(await backend.createDocument({ collection: unknownCollection, title: 'x' })).code,
        ).toBe('not-found');
        expect(failure(await backend.createDocument({ collection, title: '' })).code).toBe(
          'invalid',
        );
        expect(
          failure(await backend.createDocument({ collection, title: 'x', slug: 'Not A Slug' }))
            .code,
        ).toBe('invalid');
      });

      it('refuses creation without edit permission', async () => {
        const { readOnlyBackend, collection } = await options.create();
        if (!readOnlyBackend) return;
        expect(
          failure(await readOnlyBackend.createDocument({ collection, title: 'nope' })).code,
        ).toBe('forbidden');
      });
    });

    describe('load', () => {
      it('returns a parseable document at an integer revision', async () => {
        const { backend, existing } = await options.create();
        const loaded = value(await backend.load(existing));
        expect(parseDocument(loaded.document).ok).toBe(true);
        expect(Number.isInteger(loaded.revision)).toBe(true);
        expect(loaded.contextRef).toBe(`${existing.collection}:${existing.id}`);
      });

      it('accepts the default locale', async () => {
        const { backend, existing } = await options.create();
        const session = value(await backend.getSession());
        const locale = session.locales?.default;
        expect((await backend.load(existing, locale ? { locale } : {})).ok).toBe(true);
      });

      it('answers not-found for a missing document', async () => {
        const { backend, missing } = await options.create();
        expect(failure(await backend.load(missing)).code).toBe('not-found');
      });

      it('returns a copy: mutating the result does not change the stored document', async () => {
        const { backend, existing } = await options.create();
        const loaded = value(await backend.load(existing));
        (loaded.document.nodes as Record<string, unknown>)['injected'] = {
          id: 'injected',
          type: 'x',
        };
        const again = value(await backend.load(existing));
        expect('injected' in again.document.nodes).toBe(false);
      });
    });

    describe('save', () => {
      it('persists and increments the revision', async () => {
        const { backend, existing } = await options.create();
        const loaded = value(await backend.load(existing));
        const saved = value(await backend.save(existing, loaded.document, loaded.revision));
        expect(saveResultSchema.safeParse(saved).success).toBe(true);
        expect(saved.revision).toBeGreaterThan(loaded.revision);
        const again = value(await backend.load(existing));
        expect(again.revision).toBe(saved.revision);
        expect(again.document).toEqual(loaded.document);
      });

      it('answers conflict with the current revision for a stale baseRevision and writes nothing', async () => {
        const { backend, existing } = await options.create();
        const loaded = value(await backend.load(existing));
        const first = value(await backend.save(existing, loaded.document, loaded.revision));
        const error = failure(await backend.save(existing, loaded.document, loaded.revision));
        expect(error.code).toBe('conflict');
        if (error.code === 'conflict') expect(error.currentRevision).toBe(first.revision);
        expect(value(await backend.load(existing)).revision).toBe(first.revision);
      });

      it('answers invalid for a document that does not parse and writes nothing', async () => {
        const { backend, existing } = await options.create();
        const loaded = value(await backend.load(existing));
        const error = failure(
          await backend.save(existing, { nonsense: true } as never, loaded.revision),
        );
        expect(error.code).toBe('invalid');
        if (error.code === 'invalid') expect(error.diagnostics.length).toBeGreaterThan(0);
        expect(value(await backend.load(existing)).revision).toBe(loaded.revision);
      });

      it('answers not-found for a missing document', async () => {
        const { backend, existing, missing } = await options.create();
        const loaded = value(await backend.load(existing));
        expect(failure(await backend.save(missing, loaded.document, 0)).code).toBe('not-found');
      });

      it('answers forbidden without edit permission', async () => {
        const { backend, readOnlyBackend, existing } = await options.create();
        if (!readOnlyBackend) return;
        const loaded = value(await backend.load(existing));
        expect(
          failure(await readOnlyBackend.save(existing, loaded.document, loaded.revision)).code,
        ).toBe('forbidden');
      });
    });

    describe('publish', () => {
      it('publishes the draft and reports the new revision', async () => {
        const { backend, existing } = await options.create();
        const loaded = value(await backend.load(existing));
        const published = value(await backend.publish(existing, loaded.revision));
        expect(publishResultSchema.safeParse(published).success).toBe(true);
        expect(published.revision).toBeGreaterThanOrEqual(loaded.revision);
        expect(value(await backend.load(existing)).status).toBe('published');
      });

      it('answers conflict for a stale baseRevision', async () => {
        const { backend, existing } = await options.create();
        const loaded = value(await backend.load(existing));
        value(await backend.save(existing, loaded.document, loaded.revision));
        expect(failure(await backend.publish(existing, loaded.revision)).code).toBe('conflict');
      });

      it('answers not-found for a missing document', async () => {
        const { backend, missing } = await options.create();
        expect(failure(await backend.publish(missing, 0)).code).toBe('not-found');
      });

      it('answers forbidden without publish permission', async () => {
        const { noPublishBackend, backend, existing } = await options.create();
        if (!noPublishBackend) return;
        const loaded = value(await backend.load(existing));
        expect(failure(await noPublishBackend.publish(existing, loaded.revision)).code).toBe(
          'forbidden',
        );
      });
    });

    describe('data schema, media, preview', () => {
      it('returns a valid data schema, or not-found for a collection without one', async () => {
        const { backend, dataSchemaCollection, noDataSchemaCollection } = await options.create();
        expect(
          dataSchemaSchema.safeParse(value(await backend.getDataSchema(dataSchemaCollection)))
            .success,
        ).toBe(true);
        expect(failure(await backend.getDataSchema(noDataSchemaCollection)).code).toBe('not-found');
      });

      it('lists media as valid assets on a 1-based page', async () => {
        const { backend } = await options.create();
        const media = value(await backend.listMedia());
        expect(media.page).toBe(1);
        for (const item of media.items) expect(mediaAssetSchema.safeParse(item).success).toBe(true);
        const none = value(await backend.listMedia({ search: 'no-such-media-zzz-9' }));
        expect(none.items).toEqual([]);
      });

      it('returns a preview URL (or null) and not-found for a missing document', async () => {
        const { backend, existing, missing } = await options.create();
        const url = value(await backend.previewUrl(existing));
        expect(url === null || typeof url === 'string').toBe(true);
        expect(failure(await backend.previewUrl(missing)).code).toBe('not-found');
      });
    });
  });
}
