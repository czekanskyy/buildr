import { createRegistryMeta, type RegistryManifest, toManifest } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import type { McpBackend } from '../backend.ts';
import { createTestManifest, createTestMemoryBackend, TEST_COLLECTION } from '../testing/index.ts';
import { createSessionStore, DEFAULT_SESSION_TTL_MS, type SessionStoreOptions } from './store.ts';

const ref1 = { collection: TEST_COLLECTION, id: '1' };
const ref2 = { collection: TEST_COLLECTION, id: '2' };

function setup(
  options: Partial<SessionStoreOptions> = {},
  backend: McpBackend = createTestMemoryBackend(),
) {
  const clock = { t: 1_000 };
  const store = createSessionStore({ backend, now: () => clock.t, ...options });
  return { store, clock, backend };
}

const insert = {
  type: 'node.insert',
  payload: {
    parentId: 'root',
    slot: 'default',
    index: 0,
    fragment: {
      format: 'buildr/fragment',
      schemaVersion: 1,
      components: { 'buildr/heading': 1 },
      roots: ['aaaaaaaaaa'],
      nodes: { aaaaaaaaaa: { id: 'aaaaaaaaaa', type: 'buildr/heading' } },
    },
  },
} as const;

describe('SessionStore', () => {
  it('opens a session from the backend and returns it by id', async () => {
    const { store } = setup();
    const opened = await store.open(ref1);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.revision).toBe(0);
    expect(opened.value.dirty).toBe(false);
    const again = await store.get(opened.value.id);
    expect(again.ok && again.value).toBe(opened.value);
    expect(store.size).toBe(1);
  });

  it('surfaces backend errors typed', async () => {
    const { store } = setup();
    const result = await store.open({ collection: TEST_COLLECTION, id: 'nope' });
    expect(!result.ok && result.error.code).toBe('backend');
    expect(!result.ok && result.error.backend?.code).toBe('not-found');
  });

  it('creates a draft and opens a session on it', async () => {
    const { store, backend } = setup();
    const created = await store.create({ collection: TEST_COLLECTION, title: 'New' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const listed = await backend.listDocuments({ collection: TEST_COLLECTION });
    expect(listed.ok && listed.value.items.some((i) => i.title === 'New')).toBe(true);
  });

  it('opens a read-only session when the agent user cannot edit', async () => {
    const { store } = setup(
      {},
      createTestMemoryBackend({ session: { permissions: { canEdit: false } } }),
    );
    const opened = await store.open(ref1);
    expect(opened.ok && opened.value.readOnly).toBe(true);
  });

  it('drops idle sessions after the TTL (injected clock) and refreshes on use', async () => {
    const { store, clock } = setup({ ttlMs: 10_000, manifestCheckIntervalMs: 1e9 });
    const opened = await store.open(ref1);
    if (!opened.ok) throw new Error('open failed');
    const id = opened.value.id;

    clock.t += 9_000;
    expect((await store.get(id)).ok).toBe(true); // refreshes
    clock.t += 9_000;
    expect((await store.get(id)).ok).toBe(true);
    clock.t += 10_000;
    const expired = await store.get(id);
    expect(!expired.ok && expired.error.code).toBe('session-not-found');
    expect(store.size).toBe(0);
  });

  it('defaults to a 30 minute TTL', async () => {
    const { store, clock } = setup();
    const opened = await store.open(ref1);
    if (!opened.ok) throw new Error('open failed');
    expect(DEFAULT_SESSION_TTL_MS).toBe(30 * 60_000);
    clock.t += DEFAULT_SESSION_TTL_MS - 1;
    expect(store.list()).toHaveLength(1);
    clock.t += 1;
    expect(store.sweep()).toBe(1);
  });

  it('caps open sessions per user and frees a slot on close', async () => {
    const { store } = setup({ maxSessionsPerUser: 2 });
    const a = await store.open(ref1);
    await store.open(ref2);
    const third = await store.open(ref1);
    expect(!third.ok && third.error.code).toBe('session-limit');
    if (!a.ok) throw new Error('open failed');
    expect(store.close(a.value.id).ok).toBe(true);
    expect((await store.open(ref1)).ok).toBe(true);
  });

  it('refuses to close a dirty session unless discarding', async () => {
    const { store } = setup();
    const opened = await store.open(ref1);
    if (!opened.ok) throw new Error('open failed');
    opened.value.apply([insert]);
    const refused = store.close(opened.value.id);
    expect(!refused.ok && refused.error.code).toBe('unsaved-changes');
    const closed = store.close(opened.value.id, { discard: true });
    expect(closed.ok && closed.value.discarded).toBe(true);
    const gone = await store.get(opened.value.id);
    expect(!gone.ok && gone.error.code).toBe('session-not-found');
  });

  it('pins the manifest: a change forces a reopen with a clear error', async () => {
    const base = createTestMemoryBackend();
    let manifest: RegistryManifest = createTestManifest();
    const backend: McpBackend = {
      ...base,
      getManifest: async () => ({ ok: true, value: manifest }),
      getSession: () => base.getSession(),
      load: (r, o) => base.load(r, o),
    };
    const { store, clock } = setup({ manifestCheckIntervalMs: 1000 }, backend);
    const opened = await store.open(ref1);
    if (!opened.ok) throw new Error('open failed');
    expect((await store.get(opened.value.id)).ok).toBe(true);

    const meta = createRegistryMeta({
      components: [
        ...Object.values(manifest.components),
        { ...Object.values(manifest.components)[1]!, type: 'acme/extra' },
      ],
    });
    manifest = toManifest(meta);
    clock.t += 2_000;
    const stale = await store.get(opened.value.id);
    expect(!stale.ok && stale.error.code).toBe('manifest-changed');
    expect(!stale.ok && stale.error.message).toMatch(/open the document again/);
    // still reachable to close/save when explicitly allowed
    expect((await store.get(opened.value.id, { ignoreManifest: true })).ok).toBe(true);
  });
});
