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
import { createEditorStore, EditorStoreProvider } from '../store/index.ts';
import { comboOf, displayCombo, isTypingTarget, type KeyInput, normalizeCombo } from './keys.ts';
import { DEFAULT_SHORTCUTS } from './map.ts';
import { createShortcutRegistry } from './registry.ts';
import { ShortcutProvider, useForwardedKeys } from './shortcuts.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const none = { shift: false, alt: false, ctrl: false, meta: false };
const press = (key: string, mods: Partial<KeyInput['mods']> = {}): KeyInput => ({
  key,
  mods: { ...none, ...mods },
});

describe('combinations', () => {
  it('normalizes spellings of one combination to the same text', () => {
    expect(normalizeCombo('Shift+Mod+Z')).toBe('mod+shift+z');
    expect(normalizeCombo('Del')).toBe('delete');
    expect(normalizeCombo('alt+Up')).toBe('alt+arrowup');
  });

  it('reads Cmd as the primary key on a Mac and Ctrl elsewhere', () => {
    expect(comboOf(press('z', { meta: true }), 'mac')).toBe('mod+z');
    expect(comboOf(press('z', { ctrl: true }), 'mac')).toBe('ctrl+z');
    expect(comboOf(press('z', { ctrl: true }), 'other')).toBe('mod+z');
    expect(comboOf(press('Z', { ctrl: true, shift: true }), 'other')).toBe('mod+shift+z');
  });

  it('shows them the way the platform writes them', () => {
    expect(displayCombo('mod+shift+z', 'mac')).toBe('⌘⇧Z');
    expect(displayCombo('mod+shift+z', 'other')).toBe('Ctrl+Shift+Z');
  });

  it('knows where the keyboard belongs to text', () => {
    const input = document.createElement('input');
    const box = document.createElement('input');
    box.type = 'checkbox';
    const editable = document.createElement('div');
    editable.setAttribute('role', 'textbox');
    const inner = document.createElement('span');
    editable.append(inner);
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(inner)).toBe(true);
    expect(isTypingTarget(box)).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('registry', () => {
  it('runs the handler of a shortcut and reports it', () => {
    const registry = createShortcutRegistry({ platform: 'other' });
    const undo = vi.fn();
    registry.bind('edit.undo', undo);
    expect(registry.handle(press('z', { ctrl: true }), { typing: false })).toBe(true);
    expect(undo).toHaveBeenCalledOnce();
  });

  it('does nothing while typing', () => {
    const registry = createShortcutRegistry({ platform: 'other' });
    const undo = vi.fn();
    registry.bind('edit.undo', undo);
    expect(registry.handle(press('z', { ctrl: true }), { typing: true })).toBe(false);
    expect(undo).not.toHaveBeenCalled();
  });

  it('leaves the key alone when the handler declines', () => {
    const registry = createShortcutRegistry({ platform: 'other' });
    registry.bind('edit.delete', () => false);
    expect(registry.handle(press('Delete'), { typing: false })).toBe(false);
  });

  it('only fires bindings of an active scope, the latest first', () => {
    const registry = createShortcutRegistry({ platform: 'other' });
    const editor = vi.fn();
    const dialog = vi.fn();
    registry.bind('selection.clear', editor);
    registry.bind('selection.clear', dialog, 'dialog');
    registry.handle(press('Escape'), { typing: false });
    expect(dialog).not.toHaveBeenCalled();
    expect(editor).toHaveBeenCalledOnce();
    registry.setScopes(['dialog']);
    registry.handle(press('Escape'), { typing: false });
    expect(dialog).toHaveBeenCalledOnce();
    expect(editor).toHaveBeenCalledOnce();
  });

  it('applies overrides, and an empty override turns a shortcut off', () => {
    const registry = createShortcutRegistry({
      platform: 'other',
      overrides: { 'edit.duplicate': 'mod+j', 'edit.copy': '' },
    });
    const duplicate = vi.fn();
    registry.bind('edit.duplicate', duplicate);
    expect(registry.handle(press('d', { ctrl: true }), { typing: false })).toBe(false);
    expect(registry.handle(press('j', { ctrl: true }), { typing: false })).toBe(true);
    expect(registry.keysFor('edit.copy')).toEqual([]);
  });

  it('gives every shortcut in the map its own combinations', () => {
    const seen = new Set<string>();
    for (const shortcut of DEFAULT_SHORTCUTS) {
      for (const combo of shortcut.keys) {
        expect(seen.has(combo)).toBe(false);
        seen.add(combo);
      }
    }
  });
});

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
    root: {
      id: 'root',
      type: 'buildr/page',
      slots: { default: ['itemAAAAA1', 'itemBBBBB1', 'itemCCCCC1'] },
    },
    itemAAAAA1: { id: 'itemAAAAA1', type: 'buildr/item' },
    itemBBBBB1: { id: 'itemBBBBB1', type: 'buildr/item' },
    itemCCCCC1: { id: 'itemCCCCC1', type: 'buildr/item' },
  },
  components: {},
});

describe('ShortcutProvider', () => {
  let container: HTMLElement;
  let root: Root;
  let forwarded: (input: KeyInput) => boolean;
  const actions = {
    copy: vi.fn(() => true),
    cut: vi.fn(() => true),
    paste: vi.fn(() => true),
    save: vi.fn(() => true),
  };

  function Probe() {
    forwarded = useForwardedKeys();
    return <input aria-label="field" />;
  }

  async function mount() {
    const store = createEditorStore({
      doc: fixture(),
      registry: registryMeta,
      generateId: createSeededIdGenerator(5),
      validationDelayMs: null,
    });
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <EditorStoreProvider store={store}>
            <ShortcutProvider platform="other" actions={actions}>
              <Probe />
            </ShortcutProvider>
          </EditorStoreProvider>
        </MessagesProvider>,
      ),
    );
    return store;
  }
  const key = (target: EventTarget, init: KeyboardEventInit & { key: string }) =>
    act(async () => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
      );
    });
  const order = (store: Awaited<ReturnType<typeof mount>>) =>
    store.getState().doc.nodes['root']?.slots?.['default'];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    for (const fn of Object.values(actions)) fn.mockClear();
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('deletes, undoes and redoes the selection', async () => {
    const store = await mount();
    act(() => store.select('itemBBBBB1'));
    await key(document.body, { key: 'Delete' });
    expect(order(store)).toEqual(['itemAAAAA1', 'itemCCCCC1']);
    await key(document.body, { key: 'z', ctrlKey: true });
    expect(order(store)).toEqual(['itemAAAAA1', 'itemBBBBB1', 'itemCCCCC1']);
    await key(document.body, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(order(store)).toEqual(['itemAAAAA1', 'itemCCCCC1']);
  });

  it('duplicates, moves and clears', async () => {
    const store = await mount();
    act(() => store.select('itemBBBBB1'));
    await key(document.body, { key: 'ArrowUp', altKey: true });
    expect(order(store)).toEqual(['itemBBBBB1', 'itemAAAAA1', 'itemCCCCC1']);
    await key(document.body, { key: 'ArrowDown', altKey: true });
    expect(order(store)).toEqual(['itemAAAAA1', 'itemBBBBB1', 'itemCCCCC1']);
    await key(document.body, { key: 'd', ctrlKey: true });
    expect(order(store)?.length).toBe(4);
    await key(document.body, { key: 'Escape' });
    expect(store.getState().selectedIds).toEqual([]);
  });

  it('selects the siblings of the anchor', async () => {
    const store = await mount();
    act(() => store.select('itemAAAAA1'));
    await key(document.body, { key: 'a', ctrlKey: true });
    expect(store.getState().selectedIds).toEqual(['itemAAAAA1', 'itemBBBBB1', 'itemCCCCC1']);
  });

  it('calls the actions of other modules and prevents the browser default', async () => {
    await mount();
    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      document.body.dispatchEvent(event);
    });
    expect(actions.save).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    for (const [name, k] of [
      ['copy', 'c'],
      ['cut', 'x'],
      ['paste', 'v'],
    ] as const) {
      await key(document.body, { key: k, ctrlKey: true });
      expect(actions[name]).toHaveBeenCalledOnce();
    }
  });

  it('does not fire while a text field has focus', async () => {
    const store = await mount();
    act(() => store.select('itemBBBBB1'));
    const field = container.querySelector('input') as HTMLInputElement;
    await key(field, { key: 'Delete' });
    await key(field, { key: 'z', ctrlKey: true });
    await key(field, { key: 's', ctrlKey: true });
    expect(order(store)).toEqual(['itemAAAAA1', 'itemBBBBB1', 'itemCCCCC1']);
    expect(actions.save).not.toHaveBeenCalled();
  });

  it('does not swallow a key it cannot act on', async () => {
    await mount();
    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });
    await act(async () => {
      document.body.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
  });

  it('handles keys forwarded from the canvas', async () => {
    const store = await mount();
    act(() => store.select('itemAAAAA1'));
    let handled = false;
    await act(async () => {
      handled = forwarded(press('Delete'));
    });
    expect(handled).toBe(true);
    expect(order(store)).toEqual(['itemBBBBB1', 'itemCCCCC1']);
  });

  it('opens a help dialog listing the shortcuts with ?', async () => {
    await mount();
    await key(document.body, { key: '?', shiftKey: true });
    const dialog = document.querySelector('[role=dialog]');
    expect(dialog?.textContent).toContain('Keyboard shortcuts');
    expect(dialog?.textContent).toContain('Ctrl+Shift+Z');
  });
});
