// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
} from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagesProvider } from '../messages/index.tsx';
import { createEditorStore, type EditorStore, EditorStoreProvider } from '../store/index.ts';
import { ToastProvider } from '../ui/index.ts';
import {
  createPersistence,
  EXTERNAL_CHECK_INTERVAL_MS,
  type PersistenceOptions,
  RETRY_DELAYS_MS,
} from './controller.ts';
import { LoadError, loadDocument } from './load.ts';
import { PersistenceProvider, SaveStatus, useSaveAction } from './react.tsx';
import type { DocumentAdapter, LoadedDocument, SaveRequest, SaveResult } from './types.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item: ComponentMeta = {
  type: 'buildr/item',
  version: 1,
  label: 'Item',
  category: 'content',
  props: {},
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
  slots: { default: {} },
};
const page: ComponentMeta = {
  ...item,
  type: 'buildr/page',
  label: 'Page',
  capabilities: { root: true },
};
const registryMeta = createRegistryMeta({ components: [page, item] });

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['itemAAAAA1', 'itemBBBBB1'] } },
    itemAAAAA1: { id: 'itemAAAAA1', type: 'buildr/item' },
    itemBBBBB1: { id: 'itemBBBBB1', type: 'buildr/item' },
  },
  components: {},
});

const ref = { collection: 'pages', id: '1' };

interface Fake {
  readonly adapter: DocumentAdapter;
  readonly saves: SaveRequest[];
  /** What the next save answers; a promise lets a test hold a save open. */
  next: (request: SaveRequest) => Promise<SaveResult> | SaveResult;
  loaded: unknown;
  canEdit: boolean;
  /** What `getRevision` answers; `revisionCalls` counts the asks. */
  remote: { revision: number; updatedBy?: string };
  revisionCalls: number;
}

function fakeAdapter(): Fake {
  const saves: SaveRequest[] = [];
  let revision = 1;
  const fake: Fake = {
    saves,
    next: () => ({ ok: true, revision: ++revision, updatedAt: `t${revision}` }),
    loaded: {
      title: 'Home',
      status: 'draft',
      updatedAt: 't1',
      revision: 5,
      document: fixture(),
    },
    canEdit: true,
    remote: { revision: 1 },
    revisionCalls: 0,
    adapter: {
      getRevision: async () => {
        fake.revisionCalls += 1;
        return { updatedAt: 't', ...fake.remote };
      },
      getSession: async () => ({ canEdit: fake.canEdit, canPublish: false }),
      load: async () => fake.loaded as LoadedDocument,
      save: async (_ref, request) => {
        saves.push(request);
        return fake.next(request);
      },
      publish: async () => ({ ok: true, revision: 1, updatedAt: 't' }),
      getDataSchema: async () => ({ scopes: {}, entities: {} }),
      getContext: async () => {
        throw new Error('unused');
      },
      media: { search: async () => ({ items: [] }) },
      previewUrl: () => '/preview',
    },
  };
  return fake;
}

function setup(fake = fakeAdapter(), revision = 1, extra: Partial<PersistenceOptions> = {}) {
  const store = createEditorStore({
    doc: fixture(),
    registry: registryMeta,
    generateId: createSeededIdGenerator(9),
    validationDelayMs: null,
  });
  const controller = createPersistence({
    store,
    adapter: fake.adapter,
    ref,
    revision,
    debounceMs: 2000,
    maxWaitMs: 20_000,
    ...extra,
  });
  const stop = controller.start();
  return { fake, store, controller, stop };
}

let counter = 0;
const edit = (store: EditorStore, id = 'itemAAAAA1') =>
  act(() => {
    counter += 1;
    store.dispatch({
      type: 'node.setAttr',
      payload: { id, key: 'name', value: `v${counter}` },
    });
  });
const advance = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));
const status = (c: ReturnType<typeof setup>['controller']) => c.state.getState().status;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('autosave', () => {
  it('is clean until something changes, then saves after the debounce', async () => {
    const { fake, store, controller } = setup();
    expect(status(controller)).toBe('clean');
    edit(store);
    expect(status(controller)).toBe('dirty');
    await advance(1999);
    expect(fake.saves).toHaveLength(0);
    await advance(1);
    expect(fake.saves).toHaveLength(1);
    expect(fake.saves[0]).toMatchObject({ baseRevision: 1, autosave: true });
    expect(status(controller)).toBe('clean');
    expect(controller.state.getState().revision).toBe(2);
    expect(store.getState().savedCursorId).toBe(store.getState().cursorId);
  });

  it('restarts the debounce with every change but saves at the max wait', async () => {
    const { fake, store } = setup();
    for (let i = 0; i < 12; i++) {
      edit(store);
      await advance(1900);
    }
    // 12 x 1.9 s of typing without a 2 s pause: the max wait (20 s) forced one save.
    expect(fake.saves).toHaveLength(1);
  });

  it('is clean again after undoing back to the saved state', async () => {
    const { fake, store, controller } = setup();
    edit(store);
    expect(status(controller)).toBe('dirty');
    act(() => {
      store.undo();
    });
    expect(status(controller)).toBe('clean');
    await advance(30_000);
    expect(fake.saves).toHaveLength(0);
  });

  it('runs one save at a time and saves what changed meanwhile afterwards', async () => {
    const fake = fakeAdapter();
    let release: (result: SaveResult) => void = () => undefined;
    fake.next = () => new Promise<SaveResult>((resolve) => (release = resolve));
    const { store, controller } = setup(fake);
    edit(store);
    await advance(2000);
    expect(status(controller)).toBe('saving');
    edit(store, 'itemBBBBB1');
    await advance(30_000);
    expect(fake.saves).toHaveLength(1); // nothing overlaps
    fake.next = () => ({ ok: true, revision: 3, updatedAt: 't3' });
    await act(async () => release({ ok: true, revision: 2, updatedAt: 't2' }));
    expect(status(controller)).toBe('dirty');
    await advance(2000);
    expect(fake.saves).toHaveLength(2);
    expect(fake.saves[1]?.baseRevision).toBe(2);
    expect(status(controller)).toBe('clean');
  });

  it('saves at once on request, without autosave', async () => {
    const { fake, store, controller } = setup();
    edit(store);
    await act(async () => controller.saveNow());
    expect(fake.saves).toHaveLength(1);
    expect(fake.saves[0]?.autosave).toBe(false);
    await act(async () => controller.saveNow()); // nothing to save
    expect(fake.saves).toHaveLength(1);
  });

  it('does not save a read-only document', async () => {
    const { fake, store, controller } = setup();
    edit(store);
    store.setReadOnly(true);
    await act(async () => controller.saveNow());
    await advance(30_000);
    expect(fake.saves).toHaveLength(0);
  });

  it('stops for good when stopped', async () => {
    const { fake, store, stop } = setup();
    edit(store);
    stop();
    await advance(60_000);
    expect(fake.saves).toHaveLength(0);
  });
});

describe('failures', () => {
  it('retries after a network error with growing delays and stays dirty', async () => {
    const fake = fakeAdapter();
    fake.next = () => Promise.reject(new Error('offline'));
    const { store, controller } = setup(fake);
    edit(store);
    await advance(2000);
    expect(status(controller)).toBe('error');
    expect(controller.state.getState().error).toMatchObject({ kind: 'network', attempt: 1 });
    expect(controller.hasUnsavedWork()).toBe(true);
    await advance((RETRY_DELAYS_MS[0] ?? 0) - 1);
    expect(fake.saves).toHaveLength(1);
    await advance(1);
    expect(fake.saves).toHaveLength(2);
    await advance(RETRY_DELAYS_MS[1] ?? 0);
    expect(fake.saves).toHaveLength(3);
    await advance(RETRY_DELAYS_MS[2] ?? 0);
    expect(fake.saves).toHaveLength(4);
    fake.next = () => ({ ok: true, revision: 2, updatedAt: 't2' });
    await advance(RETRY_DELAYS_MS[2] ?? 0);
    expect(status(controller)).toBe('clean');
    expect(controller.state.getState().error).toBeUndefined();
  });

  it('treats a malformed reply as a failed save', async () => {
    const fake = fakeAdapter();
    fake.next = () => ({ nope: true }) as unknown as SaveResult;
    const { store, controller } = setup(fake);
    edit(store);
    await advance(2000);
    expect(status(controller)).toBe('error');
    expect(store.getState().savedCursorId).not.toBe(store.getState().cursorId);
  });

  it('does not retry a rejected document, and a change tries it again', async () => {
    const fake = fakeAdapter();
    fake.next = () => ({
      ok: false,
      kind: 'invalid',
      diagnostics: [{ code: 'x', message: 'bad', severity: 'error' }],
    });
    const { store, controller } = setup(fake);
    edit(store);
    await advance(2000);
    expect(controller.state.getState().error?.kind).toBe('invalid');
    await advance(60_000);
    expect(fake.saves).toHaveLength(1);
    edit(store);
    expect(status(controller)).toBe('dirty');
    await advance(2000);
    expect(fake.saves).toHaveLength(2);
  });
});

describe('conflicts', () => {
  const conflict = (): SaveResult => ({ ok: false, kind: 'conflict', currentRevision: 9 });

  it('stops saving and keeps the local work', async () => {
    const fake = fakeAdapter();
    fake.next = conflict;
    const { store, controller } = setup(fake);
    edit(store);
    await advance(2000);
    expect(status(controller)).toBe('conflict');
    expect(controller.state.getState().conflictRevision).toBe(9);
    edit(store);
    await advance(60_000);
    expect(fake.saves).toHaveLength(1);
    expect(controller.hasUnsavedWork()).toBe(true);
  });

  it('overwrites on the revision the backend has', async () => {
    const fake = fakeAdapter();
    fake.next = conflict;
    const { store, controller } = setup(fake);
    edit(store);
    await advance(2000);
    fake.next = () => ({ ok: true, revision: 10, updatedAt: 't10' });
    await act(async () => controller.overwrite());
    expect(fake.saves[1]?.baseRevision).toBe(9);
    expect(status(controller)).toBe('clean');
    expect(controller.state.getState().revision).toBe(10);
  });

  it('reloads the backend document and drops the local changes', async () => {
    const fake = fakeAdapter();
    fake.next = conflict;
    const { store, controller } = setup(fake);
    edit(store);
    await advance(2000);
    const theirs = fixture();
    const nodes = theirs.nodes as Record<string, unknown>;
    delete nodes['itemBBBBB1'];
    nodes['root'] = { id: 'root', type: 'buildr/page', slots: { default: ['itemAAAAA1'] } };
    fake.loaded = { ...(fake.loaded as object), revision: 9, document: theirs };
    await act(async () => controller.reload());
    expect(status(controller)).toBe('clean');
    expect(controller.state.getState().revision).toBe(9);
    expect(Object.keys(store.getState().doc.nodes).sort()).toEqual(['itemAAAAA1', 'root']);
    expect(controller.hasUnsavedWork()).toBe(false);
  });
});

describe('external changes', () => {
  it('offers a reload when somebody saved and the document is unchanged', async () => {
    const { fake, controller } = setup();
    await advance(EXTERNAL_CHECK_INTERVAL_MS - 1);
    expect(fake.revisionCalls).toBe(0);
    await advance(1);
    expect(fake.revisionCalls).toBe(1);
    expect(controller.state.getState().external).toBeUndefined();
    fake.remote = { revision: 2, updatedBy: 'agent@example.com' };
    await advance(EXTERNAL_CHECK_INTERVAL_MS);
    expect(controller.state.getState().external).toEqual({
      revision: 2,
      updatedBy: 'agent@example.com',
    });
    expect(status(controller)).toBe('clean');
    fake.loaded = { ...(fake.loaded as object), revision: 2 };
    await act(async () => controller.reload());
    expect(controller.state.getState()).toMatchObject({ revision: 2, external: undefined });
  });

  it('turns local edits after a seen external save into an immediate conflict', async () => {
    const { fake, store, controller } = setup();
    fake.remote = { revision: 4 };
    await advance(EXTERNAL_CHECK_INTERVAL_MS);
    expect(controller.state.getState().external?.revision).toBe(4);
    edit(store);
    expect(status(controller)).toBe('conflict');
    expect(controller.state.getState().conflictRevision).toBe(4);
    expect(fake.saves).toHaveLength(0);
    // Overwrite builds on the revision that was seen, so it needs no second round trip.
    await act(async () => controller.overwrite());
    expect(fake.saves[0]).toMatchObject({ baseRevision: 4 });
    expect(status(controller)).toBe('clean');
  });

  it('finds a save made elsewhere while dirty before the autosave is refused', async () => {
    const { fake, store, controller } = setup(fakeAdapter(), 1, {
      debounceMs: 60_000,
      maxWaitMs: 90_000,
    });
    edit(store);
    fake.remote = { revision: 5 };
    await advance(EXTERNAL_CHECK_INTERVAL_MS);
    expect(status(controller)).toBe('conflict');
    expect(controller.state.getState().conflictRevision).toBe(5);
    expect(fake.saves).toHaveLength(0);
  });

  it('does not poll while the tab is hidden, and checks on demand when it is shown again', async () => {
    let visible = false;
    const { fake, controller } = setup(fakeAdapter(), 1, { isVisible: () => visible });
    await advance(EXTERNAL_CHECK_INTERVAL_MS * 3);
    expect(fake.revisionCalls).toBe(0);
    visible = true;
    fake.remote = { revision: 2 };
    await act(async () => controller.checkExternal());
    expect(fake.revisionCalls).toBe(1);
    expect(controller.state.getState().external?.revision).toBe(2);
  });

  it('stops polling when stopped, ignores failures, and needs getRevision', async () => {
    const fake = fakeAdapter();
    const { controller, stop } = setup(fake);
    fake.adapter.getRevision = async () => {
      fake.revisionCalls += 1;
      throw new Error('offline');
    };
    await advance(EXTERNAL_CHECK_INTERVAL_MS);
    expect(fake.revisionCalls).toBe(1);
    expect(status(controller)).toBe('clean');
    expect(controller.state.getState().external).toBeUndefined();
    stop();
    await advance(EXTERNAL_CHECK_INTERVAL_MS * 3);
    expect(fake.revisionCalls).toBe(1);

    const bare = fakeAdapter();
    delete bare.adapter.getRevision;
    const other = setup(bare);
    await advance(EXTERNAL_CHECK_INTERVAL_MS * 2);
    await other.controller.checkExternal();
    expect(bare.revisionCalls).toBe(0);
  });

  it('ignores an answer that a save overtook', async () => {
    const fake = fakeAdapter();
    const { store, controller } = setup(fake);
    let release: () => void = () => undefined;
    fake.adapter.getRevision = () =>
      new Promise((resolve) => {
        release = () => resolve({ revision: 2, updatedAt: 't' });
      });
    const pending = controller.checkExternal();
    edit(store);
    await advance(2000);
    expect(controller.state.getState().revision).toBe(2);
    release();
    await act(async () => pending);
    expect(controller.state.getState().external).toBeUndefined();
    expect(status(controller)).toBe('clean');
  });
});

describe('loadDocument', () => {
  it('returns the validated document', async () => {
    const fake = fakeAdapter();
    const loaded = await loadDocument(fake.adapter, ref);
    expect(loaded.revision).toBe(5);
    expect(loaded.readOnly).toBe(false);
  });

  it('keeps the context the canvas binds against by default', async () => {
    const fake = fakeAdapter();
    fake.loaded = { ...(fake.loaded as object), contextRef: 'pages:7' };
    expect((await loadDocument(fake.adapter, ref)).contextRef).toBe('pages:7');
  });

  it('opens a document read-only when the session cannot edit or the backend says so', async () => {
    const fake = fakeAdapter();
    fake.canEdit = false;
    expect((await loadDocument(fake.adapter, ref)).readOnly).toBe(true);
    fake.canEdit = true;
    fake.loaded = { ...(fake.loaded as object), readOnly: true };
    expect((await loadDocument(fake.adapter, ref)).readOnly).toBe(true);
  });

  it('refuses malformed replies and invalid documents', async () => {
    const fake = fakeAdapter();
    fake.loaded = { title: 1 };
    await expect(loadDocument(fake.adapter, ref)).rejects.toBeInstanceOf(LoadError);
    fake.loaded = { ...(fakeAdapter().loaded as object), document: { nope: true } };
    await expect(loadDocument(fake.adapter, ref)).rejects.toBeInstanceOf(LoadError);
  });
});

describe('PersistenceProvider', () => {
  let container: HTMLElement;
  let root: Root;
  let saveAction: () => boolean;

  function Probe() {
    saveAction = useSaveAction();
    return <SaveStatus />;
  }
  async function mount(fake: Fake) {
    const { store, controller } = setup(fake);
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <ToastProvider>
            <EditorStoreProvider store={store}>
              <PersistenceProvider controller={controller}>
                <Probe />
              </PersistenceProvider>
            </EditorStoreProvider>
          </ToastProvider>
        </MessagesProvider>,
      ),
    );
    return { store, controller };
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('shows the status and saves on the save action', async () => {
    const fake = fakeAdapter();
    const { store } = await mount(fake);
    expect(container.textContent).toContain('All changes saved');
    edit(store);
    expect(container.textContent).toContain('Unsaved changes');
    await act(async () => {
      expect(saveAction()).toBe(true);
    });
    expect(fake.saves).toHaveLength(1);
    expect(container.textContent).toContain('All changes saved');
  });

  it('warns before the tab closes while there is unsaved work', async () => {
    const fake = fakeAdapter();
    const { store } = await mount(fake);
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    edit(store);
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('announces who saved in the toast region, and reloads from it', async () => {
    const fake = fakeAdapter();
    const { controller } = await mount(fake);
    const banner = () => container.ownerDocument.querySelector('.bd-toast-region [role=status]');
    expect(banner()?.textContent).toBe('');
    fake.remote = { revision: 2, updatedBy: 'Claude agent' };
    fake.loaded = { ...(fake.loaded as object), revision: 2 };
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(banner()?.textContent).toContain('Claude agent saved a newer version');
    const reload = banner()?.querySelector('button');
    expect(reload?.textContent).toBe('Reload the latest version');
    await act(async () => reload?.click());
    expect(banner()?.textContent).toBe('');
    expect(controller.state.getState().revision).toBe(2);
  });

  it('asks the author to choose in a conflict', async () => {
    const fake = fakeAdapter();
    fake.next = () => ({ ok: false, kind: 'conflict', currentRevision: 9 });
    const { store, controller } = await mount(fake);
    edit(store);
    await advance(2000);
    const dialog = document.querySelector('[role=dialog]');
    expect(dialog?.textContent).toContain('This page was changed elsewhere');
    fake.next = () => ({ ok: true, revision: 10, updatedAt: 't10' });
    const overwrite = [...(dialog?.querySelectorAll('button') ?? [])].find((b) =>
      b.textContent?.includes('Overwrite'),
    );
    await act(async () => overwrite?.click());
    expect(status(controller)).toBe('clean');
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
