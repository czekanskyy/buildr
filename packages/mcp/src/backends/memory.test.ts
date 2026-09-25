import { describe, expect, it } from 'vitest';
import {
  createTestManifest,
  createTestMemoryBackend,
  runBackendContract,
  TEST_COLLECTION,
} from '../testing/index.ts';
import { createMemoryBackend } from './memory.ts';

const now = () => new Date('2026-01-01T00:00:00.000Z');

runBackendContract({
  name: 'memory backend',
  async create() {
    return {
      backend: createTestMemoryBackend({ now }),
      readOnlyBackend: createTestMemoryBackend({
        now,
        session: { permissions: { canEdit: false } },
      }),
      noPublishBackend: createTestMemoryBackend({
        now,
        session: { permissions: { canPublish: false } },
      }),
      existing: { collection: TEST_COLLECTION, id: '1' },
      missing: { collection: TEST_COLLECTION, id: 'nope' },
      collection: TEST_COLLECTION,
      unknownCollection: 'nothing',
      dataSchemaCollection: TEST_COLLECTION,
      noDataSchemaCollection: 'nothing',
    };
  },
});

describe('memory backend specifics', () => {
  it('uses the injected clock', async () => {
    const backend = createTestMemoryBackend({ now });
    const loaded = await backend.load({ collection: TEST_COLLECTION, id: '1' });
    expect(loaded.ok && loaded.value.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('reports a builtin layout for a blank document and derives the preview url', async () => {
    const backend = createMemoryBackend({
      manifest: createTestManifest(),
      previewBaseUrl: 'http://localhost:3000/',
      documents: [{ ref: { collection: 'pages', id: 1 }, title: 'Home', slug: 'home' }],
    });
    const loaded = await backend.load({ collection: 'pages', id: 1 });
    expect(loaded.ok && loaded.value.layoutSource).toBe('builtin');
    expect(await backend.previewUrl({ collection: 'pages', id: 1 }, 'de')).toEqual({
      ok: true,
      value: 'http://localhost:3000/home?locale=de',
    });
  });

  it('marks documents read-only when editing is not permitted', async () => {
    const backend = createTestMemoryBackend({ session: { permissions: { canEdit: false } } });
    const loaded = await backend.load({ collection: TEST_COLLECTION, id: '1' });
    expect(loaded.ok && loaded.value.readOnly).toBe(true);
  });
});
