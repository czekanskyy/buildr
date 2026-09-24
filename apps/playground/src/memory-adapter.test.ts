import { describe, expect, it } from 'vitest';
import { createMemoryAdapter, sampleScopes } from './memory-adapter.ts';

const ref = { collection: 'pages', id: 'p' };
const memoryStorage = () => {
  const data: Record<string, string> = {};
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
};

describe('createMemoryAdapter', () => {
  it('saves a document and loads it back at the next revision', async () => {
    const storage = memoryStorage();
    const adapter = createMemoryAdapter({ storage });
    const first = await adapter.load(ref);
    const saved = await adapter.save(ref, {
      document: first.document,
      baseRevision: first.revision,
      autosave: false,
    });
    expect(saved).toMatchObject({ ok: true, revision: first.revision + 1 });
    // A new adapter on the same storage (a reload) sees the saved revision.
    const again = await createMemoryAdapter({ storage }).load(ref);
    expect(again.revision).toBe(first.revision + 1);
  });

  it('reports a conflict for a stale base revision, and survives blocked storage', async () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const adapter = createMemoryAdapter({ storage: blocked });
    const first = await adapter.load(ref);
    await adapter.save(ref, {
      document: first.document,
      baseRevision: first.revision,
      autosave: false,
    });
    const stale = await adapter.save(ref, {
      document: first.document,
      baseRevision: first.revision,
      autosave: false,
    });
    expect(stale).toMatchObject({ ok: false, kind: 'conflict' });
  });

  it('publishes the saved revision and offers samples in both languages', async () => {
    const adapter = createMemoryAdapter({ storage: memoryStorage() });
    const first = await adapter.load(ref);
    expect(await adapter.publish(ref, { baseRevision: first.revision })).toMatchObject({
      ok: true,
    });
    expect((await adapter.load(ref)).status).toBe('published');
    expect((await adapter.listSamples?.(ref))?.map((s) => s.id)).toEqual(['post', 'product']);
    expect((sampleScopes('post', 'pl')['post'] as { title: string }).title).toBe(
      'Budowanie stron z danych',
    );
    expect((sampleScopes('post', 'en')['post'] as { title: string }).title).toBe(
      'Building pages from data',
    );
  });
});
