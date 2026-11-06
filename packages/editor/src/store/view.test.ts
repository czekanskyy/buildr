import { createRegistryMeta } from '@next-buildr/core';
import { afterEach, expect, it, vi } from 'vitest';
import { createPersistence } from '../persistence/controller.ts';
import type { DocumentAdapter, SaveRequest } from '../persistence/types.ts';
import { createEditorStore } from './create-store.ts';

afterEach(() => vi.useRealTimers());

const create = () =>
  createEditorStore({
    doc: {
      schemaVersion: 1,
      root: 'root',
      nodes: { root: { id: 'root', type: 'buildr/page' } },
      components: {},
    },
    registry: createRegistryMeta({ components: [] }),
    validationDelayMs: null,
  });

it('keeps view state separate for each editor session', () => {
  const first = create();
  const second = create();
  first.view.getState().toggleOutlines();
  first.view.getState().toggleHidden('root');
  expect(first.view.getState()).toMatchObject({ outlines: true, hiddenIds: ['root'] });
  expect(second.view.getState()).toMatchObject({ outlines: false, hiddenIds: [] });
  expect(first.getState().docVersion).toBe(0);
  expect(first.getState().canUndo).toBe(false);
});

it('never sends hidden ids or outlines in the autosave payload', async () => {
  vi.useFakeTimers();
  const store = create();
  const saves: SaveRequest[] = [];
  const adapter = {
    save: async (_ref: unknown, request: SaveRequest) => {
      saves.push(request);
      return { ok: true as const, revision: 2, updatedAt: 'now' };
    },
  } as unknown as DocumentAdapter;
  const controller = createPersistence({
    store,
    adapter,
    ref: { collection: 'pages', id: '1' },
    revision: 1,
    debounceMs: 10,
    maxWaitMs: 100,
  });
  const stop = controller.start();
  const document = store.getState().doc;
  store.view.getState().toggleOutlines();
  store.view.getState().setHiddenIds(['root']);
  store.view.getState().setInsertionTarget({ parentId: 'root', slot: 'default', index: 0 });
  await vi.advanceTimersByTimeAsync(100);
  expect(saves).toEqual([]);
  // Simulate a dirty document notification without requiring a component registry.
  store.setState({ cursorId: 'dirty' });
  await vi.advanceTimersByTimeAsync(100);
  expect(saves).toEqual([{ document, baseRevision: 1, autosave: true }]);
  expect(Object.keys(saves[0]?.document ?? {})).toEqual([
    'schemaVersion',
    'root',
    'nodes',
    'components',
  ]);
  stop();
});

const withChild = () =>
  createEditorStore({
    doc: {
      schemaVersion: 1,
      root: 'root',
      nodes: {
        root: { id: 'root', type: 'buildr/page', slots: { default: ['boxNode001'] } },
        boxNode001: { id: 'boxNode001', type: 'buildr/box' },
      },
      components: {},
    },
    registry: createRegistryMeta({ components: [] }),
    validationDelayMs: null,
  });

it('clears the insertion target when its node is removed, undone away or the page is replaced', () => {
  const target = { parentId: 'boxNode001', slot: 'default', index: 0 };
  const store = withChild();
  store.view.getState().setInsertionTarget(target);
  store.setState({
    doc: { ...store.getState().doc, nodes: { root: { id: 'root', type: 'buildr/page' } } },
  });
  expect(store.view.getState().insertionTarget).toBeNull();

  const other = withChild();
  other.view.getState().setInsertionTarget(target);
  other.replaceDocument({
    schemaVersion: 1,
    root: 'root',
    nodes: { root: { id: 'root', type: 'buildr/page' } },
    components: {},
  });
  expect(other.view.getState().insertionTarget).toBeNull();
});

it('clears the insertion target when the selection moves, and keeps it while it stays', () => {
  const target = { parentId: 'boxNode001', slot: 'default', index: 0 };
  const store = withChild();
  store.select('boxNode001');
  store.view.getState().setInsertionTarget(target);
  store.select('boxNode001');
  expect(store.view.getState().insertionTarget).toEqual(target);
  store.select('root');
  expect(store.view.getState().insertionTarget).toBeNull();
});
