// @vitest-environment jsdom
import {
  type BuilderDocument,
  createRegistryMeta,
  createSeededIdGenerator,
} from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MessagesProvider } from '../messages/index.tsx';
import { LayersPanel } from '../panels/layers/layers-panel.tsx';
import { createEditorStore, EditorStoreProvider } from '../store/index.ts';
import { DragProvider } from './react.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const meta = {
  version: 1,
  category: 'content',
  props: {},
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
} as const;
const registry = createRegistryMeta({
  components: [
    {
      ...meta,
      type: 'buildr/page',
      label: 'Page',
      capabilities: { root: true },
      slots: { default: {} },
    },
    { ...meta, type: 'buildr/box', label: 'Box', slots: { default: {} } },
    { ...meta, type: 'buildr/leaf', label: 'Leaf' },
  ],
});
const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['boxAAAAAA1', 'leafBBBBB1'] } },
    boxAAAAAA1: { id: 'boxAAAAAA1', type: 'buildr/box' },
    leafBBBBB1: { id: 'leafBBBBB1', type: 'buildr/leaf' },
  },
  components: {},
});

describe('drag and drop in the layers panel', () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  async function mount(withProvider: boolean) {
    const store = createEditorStore({
      doc: fixture(),
      registry,
      generateId: createSeededIdGenerator(5),
      validationDelayMs: null,
    });
    store.select('leafBBBBB1');
    const panel = <LayersPanel />;
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <EditorStoreProvider store={store}>
            {withProvider ? <DragProvider>{panel}</DragProvider> : panel}
          </EditorStoreProvider>
        </MessagesProvider>,
      ),
    );
    return store;
  }

  const rowMenu = async () => {
    const row = container.querySelector('[data-node-id="leafBBBBB1"]') as HTMLElement;
    await act(async () => {
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    return [...document.querySelectorAll('[role=menuitem]')] as HTMLElement[];
  };

  it('offers "Move to" only where dragging is set up, and moves with it', async () => {
    const plain = await mount(false);
    expect((await rowMenu()).map((i) => i.textContent)).not.toContain('Move to…');
    expect(plain.getState().doc.nodes['boxAAAAAA1']?.slots).toBeUndefined();
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    act(() => root.unmount());
    root = createRoot(container);

    const store = await mount(true);
    const items = await rowMenu();
    const move = items.find((i) => i.textContent === 'Move to…');
    expect(move).toBeDefined();
    await act(async () => move?.click());
    const dialog = document.querySelector('[role=dialog]');
    const into = [...(dialog?.querySelectorAll('button') ?? [])].find((b) =>
      b.textContent?.includes('Box'),
    );
    expect(into).toBeDefined();
    await act(async () => into?.click());
    expect(store.getState().doc.nodes['boxAAAAAA1']?.slots?.['default']).toEqual(['leafBBBBB1']);
    expect(store.getState().doc.nodes['root']?.slots?.['default']).toEqual(['boxAAAAAA1']);
  });
});
