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
import type { RemoveRequest } from '../app/contracts.ts';
import { MessagesProvider } from '../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../store/index.ts';
import { RemoveConfirm } from './remove-confirm.tsx';

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

const doc = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['secAAAAAA1', 'secBBBBBB1'] } },
    secAAAAAA1: {
      id: 'secAAAAAA1',
      type: 'buildr/item',
      name: 'Hero',
      slots: { default: ['itemAAAAA1', 'itemAAAAA2'] },
    },
    secBBBBBB1: { id: 'secBBBBBB1', type: 'buildr/item' },
    itemAAAAA1: { id: 'itemAAAAA1', type: 'buildr/item' },
    itemAAAAA2: { id: 'itemAAAAA2', type: 'buildr/item' },
  },
  components: {},
});

describe('RemoveConfirm', () => {
  let container: HTMLElement;
  let root: Root;
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  const render = async (request: RemoveRequest | null) => {
    const store = createEditorStore({
      doc: doc(),
      registry: createRegistryMeta({ components: [page, item] }),
      generateId: createSeededIdGenerator(5),
      validationDelayMs: null,
    });
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <EditorStoreProvider store={store}>
            <button type="button" id="opener">
              open
            </button>
            <RemoveConfirm request={request} onConfirm={onConfirm} onCancel={onCancel} />
          </EditorStoreProvider>
        </MessagesProvider>,
      ),
    );
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    onConfirm.mockClear();
    onCancel.mockClear();
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('is closed without a request', async () => {
    await render(null);
    expect(document.querySelector('[role=alertdialog]')).toBeNull();
  });

  it('is an alert dialog that names the section and counts its blocks', async () => {
    const request = { ids: ['secAAAAAA1'], hasDescendants: true };
    await render(request);
    const dialog = document.querySelector('[role=alertdialog]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Delete the section “Hero”?');
    expect(dialog?.textContent).toContain('The section contains 2 blocks.');
    expect(dialog?.textContent).toContain('Ctrl+Z');
    const buttons = [...(dialog?.querySelectorAll('button') ?? [])];
    const confirm = buttons.find((button) => button.textContent === 'Delete section');
    await act(async () => confirm?.click());
    expect(onConfirm).toHaveBeenCalledWith(request);
    const cancel = buttons.find((button) => button.textContent === 'Cancel');
    await act(async () => cancel?.click());
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('uses the plural title for several nodes', async () => {
    await render({ ids: ['secAAAAAA1', 'secBBBBBB1'], hasDescendants: true });
    expect(document.querySelector('[role=alertdialog]')?.textContent).toContain('Delete 2 blocks?');
  });

  it('cancels on Escape and returns focus to the opener', async () => {
    const request = { ids: ['secAAAAAA1'], hasDescendants: true };
    await render(null);
    const opener = document.getElementById('opener') as HTMLButtonElement;
    opener.focus();
    await render(request);
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });
    expect(onCancel).toHaveBeenCalled();
    await render(null);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement).toBe(opener);
  });
});
