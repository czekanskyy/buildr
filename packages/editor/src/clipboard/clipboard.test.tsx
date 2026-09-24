// @vitest-environment jsdom
import {
  assertDocumentInvariants,
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
} from '@buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MessagesProvider } from '../messages/index.tsx';
import { ShortcutProvider } from '../shortcuts/index.ts';
import { createEditorStore, EditorStoreProvider } from '../store/index.ts';
import { type ClipboardIO, createClipboard } from './clipboard.ts';
import {
  CLIPBOARD_MARKER,
  MAX_CLIPBOARD_BYTES,
  parseClipboardText,
  serializeFragment,
} from './format.ts';
import { ClipboardProvider, useClipboardActions } from './react.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: ComponentMeta = {
  type: 'buildr/leaf',
  version: 1,
  label: 'Leaf',
  category: 'content',
  props: {},
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
};
const box: ComponentMeta = { ...base, type: 'buildr/box', label: 'Box', slots: { default: {} } };
const page = (max?: number): ComponentMeta => ({
  ...base,
  type: 'buildr/page',
  label: 'Page',
  capabilities: { root: true },
  slots: { default: max === undefined ? {} : { max } },
});
const registryOf = (max?: number, leafVersion = 1) =>
  createRegistryMeta({ components: [page(max), box, { ...base, version: leafVersion }] });

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['boxAAAAAA1', 'leafBBBBB1'] } },
    boxAAAAAA1: { id: 'boxAAAAAA1', type: 'buildr/box', slots: { default: ['leafCCCCC1'] } },
    leafBBBBB1: { id: 'leafBBBBB1', type: 'buildr/leaf' },
    leafCCCCC1: { id: 'leafCCCCC1', type: 'buildr/leaf' },
  },
  components: { 'buildr/page': 1, 'buildr/box': 1, 'buildr/leaf': 1 },
});

const newStore = (options: { max?: number; leafVersion?: number; doc?: BuilderDocument } = {}) =>
  createEditorStore({
    doc: options.doc ?? fixture(),
    registry: registryOf(options.max, options.leafVersion),
    generateId: createSeededIdGenerator(11),
    validationDelayMs: null,
  });

/** A system clipboard that remembers the text. */
function memoryIO(): ClipboardIO & { text: string } {
  const io = {
    text: '',
    writeText: async (text: string) => {
      io.text = text;
    },
    readText: async () => io.text,
  };
  return io;
}

const rootOrder = (store: ReturnType<typeof newStore>) =>
  store.getState().doc.nodes['root']?.slots?.['default'] ?? [];

const fragmentOf = (store: ReturnType<typeof newStore>, ids: string[]) => {
  const clip = memoryIO();
  return {
    clip,
    ready: (async () => {
      store.setSelection(ids);
      await createClipboard({ store, io: clip }).copy();
      return clip.text;
    })(),
  };
};

describe('copy and paste', () => {
  it('copies the selection as marked text and pastes it after the selected node', async () => {
    const store = newStore();
    const io = memoryIO();
    const clipboard = createClipboard({ store, io, generateId: createSeededIdGenerator(21) });
    store.select('leafBBBBB1');
    expect(await clipboard.copy()).toEqual({ ok: true });
    expect(io.text.startsWith(`${CLIPBOARD_MARKER}\n`)).toBe(true);
    expect(await clipboard.paste()).toEqual({ ok: true });
    const order = rootOrder(store);
    expect(order).toHaveLength(3);
    expect(order[1]).toBe('leafBBBBB1');
    const [, , pasted] = [order[0], order[1], order[2]];
    expect(pasted).not.toBe('leafBBBBB1');
    expect(order[0]).toBe('boxAAAAAA1');
    expect(store.getState().selectedIds).toEqual([order[2]]);
    assertDocumentInvariants(store.getState().doc);
  });

  it('gives every paste its own ids', async () => {
    const store = newStore();
    const clipboard = createClipboard({ store, io: memoryIO() });
    store.select('boxAAAAAA1');
    await clipboard.copy();
    await clipboard.paste();
    await clipboard.paste();
    const ids = Object.keys(store.getState().doc.nodes);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(4 + 2 * 2);
    assertDocumentInvariants(store.getState().doc);
  });

  it('copies a container with its content, and never a node twice', async () => {
    const store = newStore();
    const io = memoryIO();
    const clipboard = createClipboard({ store, io });
    store.setSelection(['leafCCCCC1', 'boxAAAAAA1']);
    await clipboard.copy();
    const parsed = parseClipboardText(io.text);
    expect(parsed.ok && parsed.fragment.roots).toEqual(['boxAAAAAA1']);
    expect(parsed.ok && Object.keys(parsed.fragment.nodes).sort()).toEqual([
      'boxAAAAAA1',
      'leafCCCCC1',
    ]);
  });

  it('cuts to the clipboard, and the cut can be undone', async () => {
    const store = newStore();
    const clipboard = createClipboard({ store, io: memoryIO() });
    store.select('leafBBBBB1');
    expect(await clipboard.cut()).toEqual({ ok: true });
    expect(rootOrder(store)).toEqual(['boxAAAAAA1']);
    store.select('boxAAAAAA1');
    await clipboard.paste();
    expect(rootOrder(store)).toHaveLength(2);
    act(() => {
      store.undo();
      store.undo();
    });
    expect(rootOrder(store)).toEqual(['boxAAAAAA1', 'leafBBBBB1']);
  });

  it('pastes into a container when the selection cannot have a neighbour there', async () => {
    const store = newStore({ max: 2 });
    const clipboard = createClipboard({ store, io: memoryIO() });
    store.select('leafBBBBB1');
    await clipboard.copy();
    // The page holds its two nodes already: after the selection is refused, inside a leaf is
    // impossible, so the paste fails as a whole.
    const result = await clipboard.paste();
    expect(result.ok).toBe(false);
    expect(rootOrder(store)).toHaveLength(2);
    // Selecting the box gives another place: inside it.
    store.select('boxAAAAAA1');
    expect(await clipboard.paste()).toEqual({ ok: true });
    expect(store.getState().doc.nodes['boxAAAAAA1']?.slots?.['default']).toHaveLength(2);
  });

  it('pastes at the end of the page with nothing selected', async () => {
    const store = newStore();
    const clipboard = createClipboard({ store, io: memoryIO() });
    store.select('leafBBBBB1');
    await clipboard.copy();
    store.clearSelection();
    await clipboard.paste();
    expect(rootOrder(store)).toHaveLength(3);
  });

  it('refuses copying nothing, and cutting or pasting in a read-only document', async () => {
    const store = newStore();
    const clipboard = createClipboard({ store, io: memoryIO() });
    expect(await clipboard.copy()).toEqual({ ok: false, error: { code: 'empty' } });
    store.select('leafBBBBB1');
    await clipboard.copy();
    store.setReadOnly(true);
    expect(await clipboard.cut()).toEqual({ ok: false, error: { code: 'readOnly' } });
    expect(await clipboard.paste()).toEqual({ ok: false, error: { code: 'readOnly' } });
    expect(rootOrder(store)).toHaveLength(2);
  });

  it('works within the window when the system clipboard cannot be used', async () => {
    const denied: ClipboardIO = {
      writeText: () => Promise.reject(new Error('denied')),
      readText: () => Promise.reject(new Error('denied')),
    };
    for (const io of [denied, undefined]) {
      const store = newStore();
      const clipboard = createClipboard({ store, io });
      store.select('leafBBBBB1');
      expect(await clipboard.copy()).toEqual({ ok: true });
      expect(await clipboard.paste()).toEqual({ ok: true });
      expect(rootOrder(store)).toHaveLength(3);
    }
  });

  it('pastes what was copied in another document', async () => {
    const source = newStore();
    const { clip, ready } = fragmentOf(source, ['boxAAAAAA1']);
    await ready;
    const other = newStore({
      doc: {
        schemaVersion: 1,
        root: 'root',
        nodes: { root: { id: 'root', type: 'buildr/page' } },
        components: { 'buildr/page': 1 },
      },
    });
    const clipboard = createClipboard({ store: other, io: clip });
    expect(await clipboard.paste()).toEqual({ ok: true });
    expect(Object.keys(other.getState().doc.nodes)).toHaveLength(3);
    assertDocumentInvariants(other.getState().doc);
  });

  it('refuses a fragment whose components are of another version', async () => {
    const source = newStore();
    const { clip, ready } = fragmentOf(source, ['leafBBBBB1']);
    await ready;
    const newer = newStore({
      leafVersion: 2,
      doc: { ...fixture(), components: { ...fixture().components, 'buildr/leaf': 2 } },
    });
    const clipboard = createClipboard({ store: newer, io: clip });
    const result = await clipboard.paste();
    expect(result.ok).toBe(false);
    expect(rootOrder(newer)).toHaveLength(2);
  });
});

describe('hostile clipboard content', () => {
  const marked = (body: string) => `${CLIPBOARD_MARKER}\n${body}`;
  const valid = (): Record<string, unknown> => ({
    format: 'buildr/fragment',
    schemaVersion: 1,
    components: { 'buildr/leaf': 1 },
    roots: ['leafZZZZZ1'],
    nodes: { leafZZZZZ1: { id: 'leafZZZZZ1', type: 'buildr/leaf' } },
  });

  const pasteText = async (text: string) => {
    const store = newStore();
    const before = JSON.stringify(store.getState().doc);
    const io = memoryIO();
    io.text = text;
    const result = await createClipboard({ store, io }).paste();
    expect(JSON.stringify(store.getState().doc)).toBe(before);
    return result;
  };
  const code = (result: Awaited<ReturnType<typeof pasteText>>) =>
    result.ok ? 'ok' : result.error.code;

  it('rejects text that is not ours', async () => {
    expect(code(await pasteText('hello'))).toBe('notFragment');
    expect(code(await pasteText('{"format":"buildr/fragment"}'))).toBe('notFragment');
    expect(code(await pasteText(''))).toBe('notFragment');
  });

  it('rejects broken JSON, wrong shapes and other versions', async () => {
    expect(code(await pasteText(marked('{not json')))).toBe('invalid');
    expect(code(await pasteText(marked('null')))).toBe('invalid');
    expect(code(await pasteText(marked('[]')))).toBe('invalid');
    expect(code(await pasteText(marked('{"format":"buildr/fragment"}')))).toBe('invalid');
    expect(code(await pasteText('buildr-fragment/2\n{}'))).toBe('unsupported');
    expect(code(await pasteText('buildr-fragment/0\n{}'))).toBe('unsupported');
    expect(code(await pasteText('buildr-fragment/'))).toBe('unsupported');
  });

  it('rejects content over the size limit before parsing it', async () => {
    const huge = marked(`"${'x'.repeat(MAX_CLIPBOARD_BYTES)}"`);
    expect(code(await pasteText(huge))).toBe('tooLarge');
  });

  it('rejects a fragment with a dangling child, without changing the document', async () => {
    const fragment = {
      format: 'buildr/fragment',
      schemaVersion: 1,
      components: { 'buildr/box': 1 },
      roots: ['boxZZZZZZ1'],
      nodes: {
        boxZZZZZZ1: { id: 'boxZZZZZZ1', type: 'buildr/box', slots: { default: ['leafMISSING'] } },
      },
    };
    expect(code(await pasteText(serializeFragment(fragment as never)))).toBe('invalid');
  });

  it('rejects unknown components and prop injection through the command checks', async () => {
    const fragment = {
      format: 'buildr/fragment',
      schemaVersion: 1,
      components: { 'evil/script': 1 },
      roots: ['evilAAAAA1'],
      nodes: { evilAAAAA1: { id: 'evilAAAAA1', type: 'evil/script', props: { html: '<script>' } } },
    };
    expect(code(await pasteText(serializeFragment(fragment as never)))).toBe('rejected');
  });

  it('is not moved by prototype pollution attempts', async () => {
    const text = marked(
      '{"format":"buildr/fragment","schemaVersion":1,"components":{},"roots":["leafAAAAA1"],' +
        '"nodes":{"__proto__":{"polluted":true},"leafAAAAA1":{"id":"leafAAAAA1","type":"buildr/leaf"}},' +
        '"__proto__":{"polluted":true}}',
    );
    await pasteText(text);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('keeps the document valid whatever is thrown at it', async () => {
    const base = valid();
    // The unchanged fragment is fine, so each variant below fails for its own change.
    const fine = newStore();
    const io = memoryIO();
    io.text = marked(JSON.stringify(base));
    expect(await createClipboard({ store: fine, io }).paste()).toEqual({ ok: true });
    const variants: unknown[] = [
      { ...base, roots: [] },
      { ...base, roots: ['root'] },
      { ...base, extra: 1 },
      { ...base, schemaVersion: 2 },
      { ...base, nodes: {} },
    ];
    for (const variant of variants) {
      const result = await pasteText(marked(JSON.stringify(variant)));
      expect(result.ok).toBe(false);
    }
  });
});

describe('ClipboardProvider', () => {
  let container: HTMLElement;
  let root: Root;

  function Bridge() {
    return <input aria-label="field" />;
  }
  function Shortcuts(props: { children: React.ReactNode }) {
    const actions = useClipboardActions();
    return (
      <ShortcutProvider platform="other" actions={actions}>
        {props.children}
      </ShortcutProvider>
    );
  }

  async function mount(io: ClipboardIO | undefined) {
    const store = newStore();
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <EditorStoreProvider store={store}>
            <ClipboardProvider io={io}>
              <Shortcuts>
                <Bridge />
              </Shortcuts>
            </ClipboardProvider>
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

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('copies and pastes with the keyboard', async () => {
    const io = memoryIO();
    const store = await mount(io);
    act(() => store.select('leafBBBBB1'));
    await key(document.body, { key: 'c', ctrlKey: true });
    expect(io.text.startsWith(CLIPBOARD_MARKER)).toBe(true);
    await key(document.body, { key: 'v', ctrlKey: true });
    expect(rootOrder(store)).toHaveLength(3);
    await key(document.body, { key: 'x', ctrlKey: true });
    expect(rootOrder(store)).toHaveLength(2);
  });

  it('says why a paste was refused', async () => {
    const io = memoryIO();
    io.text = 'just some text';
    const store = await mount(io);
    act(() => store.select('leafBBBBB1'));
    await key(document.body, { key: 'v', ctrlKey: true });
    expect(container.parentElement?.querySelector('[role=status]')?.textContent).toContain(
      'nothing copied from the editor',
    );
    expect(rootOrder(store)).toHaveLength(2);
  });

  it('leaves copy and paste to a text field that has focus', async () => {
    const io = memoryIO();
    const store = await mount(io);
    act(() => store.select('leafBBBBB1'));
    const field = container.querySelector('input') as HTMLInputElement;
    await key(field, { key: 'c', ctrlKey: true });
    expect(io.text).toBe('');
  });
});
