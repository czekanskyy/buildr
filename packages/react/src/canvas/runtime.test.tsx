// @vitest-environment jsdom
import { type BuilderDocument, defaultTheme, type PageNode, p, s } from '@buildr/core';
import type { CanvasMessage, EditorMessage } from '@buildr/core/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from '../define/define-component.ts';
import { createRegistry } from '../define/registry.ts';
import { doc, node, Page, platform, Section } from '../render/render.test-kit.tsx';
import { CanvasRuntime, type CanvasRuntimeProps, type CanvasTransport } from './runtime.tsx';
import type { CanvasStore } from './store.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const renders: string[] = [];
let boom = false;

const Probe = defineComponent({
  version: 1,
  category: 'content',
  contentCategories: ['flow'],
  styles: { groups: [] },
  type: 'buildr/text',
  label: 'Text',
  runtime: 'shared',
  editor: { inlineProp: 'text' },
  props: { text: p.text({ default: '', bindable: true }) },
  render: ({ props, root, node: self }) => {
    renders.push(self.id);
    if (boom && props.text === 'boom') throw new Error('it broke');
    return <p {...root}>{props.text}</p>;
  },
});

const registry = createRegistry({ components: [Page, Section, Probe] });

/** The canvas's end of the channel, replaced by a double that records what is sent and lets a test speak as the editor. */
class FakeTransport {
  readonly sent: { type: string; payload: unknown }[] = [];
  closed = false;
  private readonly handlers = new Map<string, Set<(payload: never) => void>>();

  send = (type: string, payload: unknown) => {
    this.sent.push({ type, payload });
    return true;
  };
  request = () => Promise.reject(new Error('not used'));
  reply = () => false;
  on = (type: string, handler: (payload: never) => void) => {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  };
  close = () => {
    this.closed = true;
    this.handlers.clear();
  };

  emit(type: EditorMessage['type'], payload: unknown) {
    for (const handler of [...(this.handlers.get(type) ?? [])]) handler(payload as never);
  }
  of(type: CanvasMessage['type']) {
    return this.sent
      .filter((m) => m.type === type)
      .map((m) => m.payload as Record<string, unknown>);
  }
}

let container: HTMLElement;
let root: Root;
let transport: FakeTransport;
let store: CanvasStore;

beforeEach(() => {
  renders.length = 0;
  boom = false;
  transport = new FakeTransport();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const style of document.head.querySelectorAll('style')) style.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const mount = async (overrides: Partial<CanvasRuntimeProps> = {}) => {
  await act(async () => {
    root.render(
      <CanvasRuntime
        registry={registry}
        theme={defaultTheme}
        platform={platform}
        manifestHash="hash"
        rendererVersion="1.0.0"
        errorTarget={null}
        connect={() => transport as unknown as CanvasTransport}
        onStore={(s) => {
          store = s;
        }}
        {...overrides}
      />,
    );
  });
};

const init = (document_: BuilderDocument, docVersion = 1) => ({
  doc: document_,
  docVersion,
  selection: [],
  viewport: { breakpoint: 'desktop', width: 1280 },
  contextRef: null,
  locale: 'en',
  mode: 'edit',
});

const deliver = async (type: EditorMessage['type'], payload: unknown) => {
  await act(async () => transport.emit(type, payload));
};

const three = (): BuilderDocument =>
  doc(
    [
      node(1, 'buildr/section', {}, {}),
      node(2, 'buildr/text', { text: s('One') }),
      node(3, 'buildr/text', { text: s('Two') }),
    ],
    { node000001: ['node000002', 'node000003'] },
  );

const setText = (id: string, text: string, from: number) => ({
  from,
  to: from + 1,
  patches: [{ op: 'replace', path: ['nodes', id, 'props', 'text'], value: s(text) }],
});

const textOf = (id: string) => container.querySelector(`[data-bid="${id}"]`)?.textContent;

describe('CanvasRuntime: handshake', () => {
  it('says hello with the protocol version and repeats until the editor answers', async () => {
    vi.useFakeTimers();
    await mount({ helloIntervalMs: 100 });
    expect(transport.of('canvas:hello')).toEqual([
      { protocol: 1, rendererVersion: '1.0.0', manifestHash: 'hash' },
    ]);
    await act(async () => void vi.advanceTimersByTime(250));
    expect(transport.of('canvas:hello')).toHaveLength(3);

    await deliver('editor:init', init(three()));
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(transport.of('canvas:hello')).toHaveLength(3);
  });

  it('stops repeating after the configured attempts', async () => {
    vi.useFakeTimers();
    await mount({ helloIntervalMs: 100, helloAttempts: 2 });
    await act(async () => void vi.advanceTimersByTime(2000));
    expect(transport.of('canvas:hello')).toHaveLength(2);
  });

  it('renders on editor:init, marks every node with data-bid and then says ready', async () => {
    await mount();
    expect(container.innerHTML).toBe('');
    expect(transport.of('canvas:ready')).toHaveLength(0);

    await deliver('editor:init', init(three()));
    expect(textOf('node000002')).toBe('One');
    expect(textOf('node000003')).toBe('Two');
    expect(container.querySelector('[data-bid="root"]')).not.toBeNull();
    expect(transport.of('canvas:ready')).toHaveLength(1);
    expect(store.getState().version).toBe(1);
  });

  it('reports a document it cannot render as a fatal error', async () => {
    await mount();
    await deliver('editor:init', init({ schemaVersion: 99 } as never));
    expect(transport.of('canvas:error')).toEqual([expect.objectContaining({ fatal: true })]);
    expect(transport.of('canvas:ready')).toHaveLength(0);
    expect(container.innerHTML).toBe('');
  });

  it('closes the channel when it unmounts', async () => {
    await mount();
    act(() => root.unmount());
    expect(transport.closed).toBe(true);
    root = createRoot(container);
  });
});

describe('CanvasRuntime: patches', () => {
  it('applies a patch and shows it', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await deliver('doc:patch', setText('node000002', 'Changed', 1));
    expect(textOf('node000002')).toBe('Changed');
    expect(store.getState().version).toBe(2);
    expect(transport.of('doc:resync-request')).toHaveLength(0);
  });

  it('re-renders exactly one component when one prop changes', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    renders.length = 0;
    await deliver('doc:patch', setText('node000002', 'Changed', 1));
    expect(renders).toEqual(['node000002']);
    await deliver('doc:patch', setText('node000003', 'Again', 2));
    expect(renders).toEqual(['node000002', 'node000003']);
  });

  it('renders a new node and the node it was inserted into, and no sibling', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    renders.length = 0;
    const added: PageNode = { id: 'node000004', type: 'buildr/text', props: { text: s('Four') } };
    await deliver('doc:patch', {
      from: 1,
      to: 2,
      patches: [
        { op: 'add', path: ['nodes', 'node000004'], value: added },
        { op: 'add', path: ['nodes', 'node000001', 'slots', 'default', 2], value: 'node000004' },
      ],
    });
    expect(renders).toEqual(['node000004']);
    expect(textOf('node000004')).toBe('Four');
    expect(
      [...container.querySelectorAll('section > *')].map((el) => el.getAttribute('data-bid')),
    ).toEqual(['node000002', 'node000003', 'node000004']);
  });

  it('removes a node that was deleted', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await deliver('doc:patch', {
      from: 1,
      to: 2,
      patches: [
        { op: 'remove', path: ['nodes', 'node000001', 'slots', 'default', 1] },
        { op: 'remove', path: ['nodes', 'node000003'] },
      ],
    });
    expect(container.querySelector('[data-bid="node000003"]')).toBeNull();
    expect(container.querySelector('[data-bid="node000002"]')).not.toBeNull();
  });

  it('asks once for the document when a version is missed, and takes it', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await deliver('doc:patch', setText('node000002', 'Late', 5));
    await deliver('doc:patch', setText('node000002', 'Later', 6));
    expect(transport.of('doc:resync-request')).toEqual([{ have: 1 }]);
    expect(textOf('node000002')).toBe('One');

    const fresh = doc(
      [
        node(1, 'buildr/section', {}, {}),
        node(2, 'buildr/text', { text: s('Fresh') }),
        node(3, 'buildr/text', { text: s('Two') }),
      ],
      { node000001: ['node000002', 'node000003'] },
    );
    await deliver('doc:set', { doc: fresh, docVersion: 7 });
    expect(textOf('node000002')).toBe('Fresh');
    expect(store.getState().version).toBe(7);

    await deliver('doc:patch', setText('node000002', 'Next', 7));
    expect(textOf('node000002')).toBe('Next');
    await deliver('doc:patch', setText('node000002', 'Gap', 20));
    expect(transport.of('doc:resync-request')).toHaveLength(2);
  });

  it('ignores a patch it already has', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await deliver('doc:patch', setText('node000002', 'Changed', 1));
    await deliver('doc:patch', setText('node000002', 'Changed', 1));
    expect(transport.of('doc:resync-request')).toHaveLength(0);
    expect(store.getState().version).toBe(2);
  });

  it('asks for the document when a patch does not fit it', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await deliver('doc:patch', {
      from: 1,
      to: 2,
      patches: [{ op: 'replace', path: ['nodes', 'missing', 'props', 'text'], value: s('x') }],
    });
    expect(transport.of('doc:resync-request')).toEqual([{ have: 1 }]);
    expect(store.getState().version).toBe(1);
  });

  it('does not act on a patch before it has a document', async () => {
    await mount();
    await deliver('doc:patch', setText('node000002', 'x', 0));
    expect(transport.of('doc:resync-request')).toHaveLength(0);
  });
});

describe('CanvasRuntime: failures', () => {
  it('replaces a component that throws with a placeholder and tells the editor, and keeps the rest', async () => {
    boom = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    await deliver('editor:init', init(three()));
    await deliver('doc:patch', setText('node000002', 'boom', 1));

    const placeholder = container.querySelector('[data-buildr-placeholder="error"]');
    expect(placeholder?.getAttribute('data-bid')).toBe('node000002');
    expect(placeholder?.textContent).toBe('it broke');
    expect(textOf('node000003')).toBe('Two');
    expect(transport.of('canvas:error')).toEqual([
      { message: 'it broke', nodeId: 'node000002', fatal: false },
    ]);

    await deliver('doc:patch', setText('node000002', 'fixed', 2));
    expect(container.querySelector('[data-buildr-placeholder="error"]')).toBeNull();
    expect(textOf('node000002')).toBe('fixed');
  });

  it('shows a placeholder for a component that is not registered', async () => {
    const d = doc([node(1, 'acme/gone', {})]);
    await mount();
    await deliver('editor:init', init(d));
    const placeholder = container.querySelector('[data-buildr-placeholder="unknown"]');
    expect(placeholder?.textContent).toBe('acme/gone');
    expect(placeholder?.getAttribute('data-bid')).toBe('node000001');
  });

  it('reports what rendering found as diagnostics, once', async () => {
    vi.useFakeTimers();
    const d = doc([node(1, 'acme/gone', {})]);
    await mount();
    await deliver('editor:init', init(d));
    await act(async () => void vi.advanceTimersByTime(10));
    const sent = transport.of('diagnostics');
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent[0])).toContain('render.unknown-component');
  });

  it('reports an uncaught error', async () => {
    const listeners = new Map<string, (event: never) => void>();
    const errorTarget = {
      addEventListener: (type: string, l: (event: never) => void) => listeners.set(type, l),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    await mount({ errorTarget });
    listeners.get('error')?.({ message: 'kaput' } as never);
    listeners.get('unhandledrejection')?.({ reason: new Error('rejected') } as never);
    expect(transport.of('canvas:error')).toEqual([
      { message: 'kaput', fatal: false },
      { message: 'rejected', fatal: false },
    ]);
    act(() => root.unmount());
    expect(listeners.size).toBe(0);
    root = createRoot(container);
  });
});

describe('CanvasRuntime: state', () => {
  it('keeps selection, hover, viewport and mode in the store', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await deliver('selection:set', { ids: ['node000002'] });
    await deliver('hover:set', { id: 'node000003' });
    await deliver('viewport:set', { breakpoint: 'mobile', width: 375 });
    await deliver('mode:set', { mode: 'interact' });
    expect(store.getState()).toMatchObject({
      selection: ['node000002'],
      hover: 'node000003',
      viewport: { breakpoint: 'mobile', width: 375 },
      mode: 'interact',
    });
  });

  it('does not re-render a node when only the selection changes', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    renders.length = 0;
    await deliver('selection:set', { ids: ['node000002'] });
    expect(renders).toEqual([]);
  });
});

describe('CanvasRuntime: inline editing', () => {
  const dbl = async (id: string) =>
    act(async () => {
      container
        .querySelector(`[data-bid="${id}"]`)
        ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    });
  const el = (id: string) => container.querySelector(`[data-bid="${id}"]`) as HTMLElement;
  const key = async (id: string, k: string) =>
    act(async () => {
      el(id).dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
      );
    });
  const commits = () => transport.of('inline:commit');

  it('makes the text editable on a double click, and still tells the editor about it', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await dbl('node000002');
    expect(el('node000002').hasAttribute('contenteditable')).toBe(true);
    expect(transport.of('node:dblclick')).toEqual([expect.objectContaining({ id: 'node000002' })]);
  });

  it('commits once on Enter, and not again when the element loses focus', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await dbl('node000002');
    el('node000002').textContent = 'Typed';
    await key('node000002', 'Enter');
    await act(async () => {
      el('node000002').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(commits()).toEqual([{ id: 'node000002', prop: 'text', value: 'Typed' }]);
    expect(el('node000002').hasAttribute('contenteditable')).toBe(false);
  });

  it('commits when the element loses focus', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await dbl('node000002');
    el('node000002').textContent = 'Blurred';
    await act(async () => {
      el('node000002').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(commits()).toEqual([{ id: 'node000002', prop: 'text', value: 'Blurred' }]);
  });

  it('sends nothing when the text did not change', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await dbl('node000002');
    await key('node000002', 'Enter');
    expect(commits()).toEqual([]);
  });

  it('puts the old text back on Escape', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await dbl('node000002');
    el('node000002').textContent = 'Nope';
    await key('node000002', 'Escape');
    expect(commits()).toEqual([]);
    expect(textOf('node000002')).toBe('One');
    expect(el('node000002').hasAttribute('contenteditable')).toBe(false);
  });

  it('keeps a patch that arrives mid-edit away from the text being typed, then shows it', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await dbl('node000002');
    el('node000002').textContent = 'Typed';
    const textNode = el('node000002').firstChild;
    renders.length = 0;
    await deliver('doc:patch', setText('node000002', 'Server', 1));
    expect(renders).toEqual([]);
    expect(el('node000002').firstChild).toBe(textNode);
    expect(textOf('node000002')).toBe('Typed');

    await key('node000002', 'Escape');
    await deliver('doc:patch', setText('node000003', 'Other', 2));
    expect(textOf('node000002')).toBe('Server');
    expect(textOf('node000003')).toBe('Other');
  });

  it('does not select when the click is inside the text being edited', async () => {
    await mount();
    await deliver('editor:init', init(three()));
    await dbl('node000002');
    await act(async () => {
      el('node000002').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(transport.of('node:click')).toEqual([]);
  });

  it('edits static text only, and only in edit mode', async () => {
    const bound = doc([
      node(1, 'buildr/text', { text: { kind: 'binding', path: 'item.title' } as never }),
      node(2, 'buildr/text', { text: s('Plain') }),
    ]);
    await mount();
    await deliver('editor:init', init(bound));
    await dbl('node000001');
    expect(el('node000001').hasAttribute('contenteditable')).toBe(false);

    await deliver('mode:set', { mode: 'interact' });
    await dbl('node000002');
    expect(el('node000002').hasAttribute('contenteditable')).toBe(false);
  });
});
