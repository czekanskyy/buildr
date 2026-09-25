// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
} from '@buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagesProvider } from '../messages/index.tsx';
import type { DocumentAdapter } from '../persistence/index.ts';
import { createPersistence, PersistenceProvider } from '../persistence/index.ts';
import { createEditorStore, EditorStoreProvider } from '../store/index.ts';
import { ToastProvider } from '../ui/index.ts';
import { isSafePreviewUrl } from './prepare.ts';
import { usePreview } from './preview.tsx';

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
const registry = createRegistryMeta({ components: [page, item] });
const doc = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['itemAAAAA1'] } },
    itemAAAAA1: { id: 'itemAAAAA1', type: 'buildr/item' },
  },
  components: { 'buildr/page': 1, 'buildr/item': 1 },
});
const ref = { collection: 'pages', id: '1' };

describe('preview', () => {
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

  it('accepts web addresses only', () => {
    expect(isSafePreviewUrl('/blog?draft=1')).toBe(true);
    expect(isSafePreviewUrl('https://site.test/a')).toBe(true);
    expect(isSafePreviewUrl('javascript:alert(1)')).toBe(false);
    expect(isSafePreviewUrl('data:text/html,x')).toBe(false);
  });

  function setup(opts: {
    save?: () => Promise<unknown>;
    url?: string;
    target?: 'tab' | 'overlay';
  }) {
    const order: string[] = [];
    const adapter = {
      save: async () => {
        order.push('save');
        return (await opts.save?.()) ?? { ok: true, revision: 2, updatedAt: 't' };
      },
      previewUrl: () => {
        order.push('url');
        return opts.url ?? '/preview/1';
      },
    } as unknown as DocumentAdapter;
    const store = createEditorStore({
      doc: doc(),
      registry,
      generateId: createSeededIdGenerator(2),
      validationDelayMs: null,
    });
    const controller = createPersistence({ store, adapter, ref, revision: 1 });
    const open = vi.fn((url: string) => void order.push(`open:${url}`));
    let api!: ReturnType<typeof usePreview>;
    function Probe() {
      api = usePreview({ adapter, docRef: ref, target: opts.target, open });
      return (
        <>
          {api.overlay}
          <p role="status">{api.error}</p>
        </>
      );
    }
    const mount = () =>
      act(async () =>
        root.render(
          <MessagesProvider locale="en">
            <EditorStoreProvider store={store}>
              <ToastProvider>
                <PersistenceProvider controller={controller}>
                  <Probe />
                </PersistenceProvider>
              </ToastProvider>
            </EditorStoreProvider>
          </MessagesProvider>,
        ),
      );
    const edit = () =>
      act(() => {
        store.dispatch({
          type: 'node.setAttr',
          payload: { id: 'itemAAAAA1', key: 'name', value: 'A' },
        });
      });
    return { order, mount, edit, run: () => act(async () => api.preview()) };
  }

  it('saves before it asks for the address, then shows the page in an overlay', async () => {
    const { order, mount, edit, run } = setup({});
    await mount();
    edit();
    await run();
    expect(order).toEqual(['save', 'url']);
    const frame = container.ownerDocument.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toBe('/preview/1');
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('opens a tab after the save when asked to', async () => {
    const { order, mount, edit, run } = setup({ target: 'tab' });
    await mount();
    edit();
    await run();
    expect(order).toEqual(['save', 'url', 'open:/preview/1']);
  });

  it('does not preview old work when the save failed', async () => {
    const { mount, edit, run } = setup({
      save: async () => ({ ok: false, kind: 'invalid', diagnostics: [] }),
    });
    await mount();
    edit();
    await run();
    expect(document.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('could not be saved');
  });

  it('refuses an address that is not a web address', async () => {
    const { mount, run } = setup({ url: 'javascript:alert(1)' });
    await mount();
    await run();
    expect(document.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('not a web address');
  });
});
