// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  type RegistryManifest,
  toManifest,
} from '@next-buildr/core';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasHost } from '../canvas-host/index.ts';
import type { DocumentAdapter } from '../persistence/index.ts';
import { EditorApp, type EditorAppProps } from './editor-app.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The test reaches the canvas host (its status drives the empty-page state) through `onHost`.
const canvas = vi.hoisted(() => ({ host: null as CanvasHost | null }));
vi.mock('../canvas-host/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../canvas-host/index.ts')>();
  const Frame = actual.CanvasFrame;
  return {
    ...actual,
    CanvasFrame: (props: ComponentProps<typeof actual.CanvasFrame>) => (
      <Frame
        {...props}
        onHost={(host) => {
          canvas.host = host;
          props.onHost?.(host);
        }}
      />
    ),
  };
});

const item: ComponentMeta = {
  type: 'buildr/item',
  version: 1,
  label: 'Item',
  category: 'content',
  props: {},
  contentCategories: ['flow'],
  styles: { groups: ['layout'] },
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
const nested: BuilderDocument = {
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['outerAAAA1'] } },
    outerAAAA1: {
      id: 'outerAAAA1',
      type: 'buildr/item',
      name: 'Outer',
      slots: { default: ['innerAAAA1'] },
    },
    innerAAAA1: { id: 'innerAAAA1', type: 'buildr/item', name: 'Inner' },
  },
  components: { 'buildr/page': 1, 'buildr/item': 1 },
};
const empty: BuilderDocument = {
  schemaVersion: 1,
  root: 'root',
  nodes: { root: { id: 'root', type: 'buildr/page', slots: { default: [] } } },
  components: { 'buildr/page': 1 },
};
const document: BuilderDocument = {
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['itemAAAAA1'] } },
    itemAAAAA1: { id: 'itemAAAAA1', type: 'buildr/item', name: 'First' },
  },
  components: { 'buildr/page': 1, 'buildr/item': 1 },
};

const adapter = (
  overrides: Partial<DocumentAdapter> = {},
  doc: BuilderDocument = document,
): DocumentAdapter => ({
  getSession: async () => ({ canEdit: true, canPublish: true }),
  load: async () => ({
    title: 'My page',
    status: 'draft',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1,
    document: doc,
  }),
  save: async (_ref, { baseRevision }) => ({ ok: true, revision: baseRevision + 1, updatedAt: '' }),
  publish: async (_ref, { baseRevision }) => ({
    ok: true,
    revision: baseRevision,
    updatedAt: '',
  }),
  getDataSchema: async () => ({ scopes: {}, entities: {} }),
  getContext: async () => ({
    scopes: {},
    locale: 'en',
    locales: { default: 'en', fallback: true, intl: { en: 'English' } },
    timeZone: 'UTC',
    mode: 'preview',
  }),
  media: { search: async () => ({ items: [] }) },
  previewUrl: () => '/preview',
  ...overrides,
});

describe('EditorApp', () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(() => {
    container = window.document.createElement('div');
    window.document.body.append(container);
    root = createRoot(container);
    Element.prototype.scrollIntoView ??= () => {};
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    canvas.host = null;
    window.localStorage.clear();
  });

  const props = (a: DocumentAdapter): EditorAppProps => ({
    adapter: a,
    manifest: toManifest(registry) as RegistryManifest,
    registry,
    canvasUrl: 'http://localhost:9/canvas',
    documentRef: { collection: 'pages', id: '1' },
  });
  const show = async (a: DocumentAdapter) => {
    await act(async () => root.render(<EditorApp {...props(a)} />));
    // The load and the data requests settle after the first render.
    await act(async () => undefined);
  };

  it('says it is loading, then shows the toolbar, the panels and the canvas', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const a = adapter({
      getSession: async () => {
        await gate;
        return { canEdit: true, canPublish: true };
      },
    });
    await act(async () => root.render(<EditorApp {...props(a)} />));
    expect(container.querySelector('[role=status]')?.textContent).toContain('Loading');
    await act(async () => {
      release();
    });
    await act(async () => undefined);
    expect(container.querySelector('.bd-page-chip-title')?.textContent).toBe('My page');
    expect(container.querySelector('iframe')).not.toBeNull();
    expect(container.textContent).toContain('Insert');
    expect(container.textContent).toContain('Publish');
  });

  it('shows an error when the document cannot be opened', async () => {
    await show(
      adapter({
        load: async () => {
          throw new Error('nope');
        },
      }),
    );
    expect(container.querySelector('[role=alert]')?.textContent).toContain('could not be opened');
  });

  it('offers the Structure tab and does not save an untouched document', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const save = vi.fn(async (_ref: unknown, { baseRevision }: { baseRevision: number }) => ({
        ok: true as const,
        revision: baseRevision + 1,
        updatedAt: '',
      }));
      await show(adapter({ save: save as never }));
      const layers = [...container.querySelectorAll('[role=tab]')].find(
        (tab) => tab.textContent === 'Structure',
      ) as HTMLElement;
      expect(layers).toBeDefined();
      expect(save).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  const tab = (name: string) =>
    [...container.querySelectorAll('[role=tab]')].find((el) => el.textContent === name) as
      | HTMLElement
      | undefined;
  const rows = () => [...container.querySelectorAll('[role=treeitem]')] as HTMLElement[];
  const rowNamed = (name: string) => rows().find((row) => row.textContent?.includes(name));
  const press = async (init: KeyboardEventInit) => {
    await act(async () => {
      window.document.body.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
      );
    });
  };
  const openStructure = async () => {
    await act(async () => tab('Structure')?.click());
  };
  const toastUndo = () =>
    [...window.document.querySelectorAll('.bd-toast button')].find(
      (b) => b.textContent === 'Undo',
    ) as HTMLElement | undefined;

  it('removes a block without descendants at once and the Undo toast restores it', async () => {
    await show(adapter());
    await openStructure();
    await act(async () => rowNamed('First')?.click());
    await press({ key: 'Delete' });
    expect(rowNamed('First')).toBeUndefined();
    expect(window.document.querySelector('[role=alertdialog]')).toBeNull();
    expect(toastUndo()).toBeDefined();
    await act(async () => toastUndo()?.click());
    expect(rowNamed('First')).toBeDefined();
  });

  it('asks before removing a block with descendants, and Cancel keeps it', async () => {
    await show(adapter({}, nested));
    await openStructure();
    await act(async () => rowNamed('Outer')?.click());
    await press({ key: 'Delete' });
    const dialog = window.document.querySelector('[role=alertdialog]');
    expect(dialog).not.toBeNull();
    expect(rowNamed('Outer')).toBeDefined();
    const cancel = [...(dialog?.querySelectorAll('button') ?? [])].find(
      (b) => b.textContent === 'Cancel',
    );
    await act(async () => cancel?.click());
    expect(window.document.querySelector('[role=alertdialog]')).toBeNull();
    expect(rowNamed('Outer')).toBeDefined();
    expect(toastUndo()).toBeUndefined();
  });

  it('switches the left panel to Patterns from the empty page', async () => {
    await show(adapter({}, empty));
    await openStructure();
    expect(container.querySelector('.bd-insert')).toBeNull();
    await act(async () => canvas.host?.state.setState({ status: 'ready' }));
    const pattern = [...container.querySelectorAll('.bd-canvas-actions button')].find(
      (b) => b.textContent === 'Choose a pattern',
    );
    await act(async () => (pattern as HTMLElement | undefined)?.click());
    expect(tab('Blocks')?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('.bd-insert')?.getAttribute('data-mode')).toBe('patterns');
  });

  it('switches the screen size with Mod+1, Mod+2 and Mod+3', async () => {
    await show(adapter());
    const label = () => container.querySelector('.bd-device-label')?.textContent ?? '';
    await press({ key: '2', ctrlKey: true });
    expect(label()).toContain('Tablet');
    await press({ key: '3', ctrlKey: true });
    expect(label()).toContain('Mobile');
    await press({ key: '1', ctrlKey: true });
    expect(label()).toContain('Desktop');
  });

  it('enables the expand-all toggle once the Style tab shows its sections', async () => {
    await show(adapter());
    await openStructure();
    await act(async () => rowNamed('First')?.click());
    // The Structure tab has an expand-all button of its own; leave it so only the inspector's remains.
    await act(async () => tab('Blocks')?.click());
    await act(async () =>
      tab('Style')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })),
    );
    const toggle = [...container.querySelectorAll('button')].find((b) =>
      /^(Expand|Collapse) all/.test(b.getAttribute('aria-label') ?? ''),
    ) as HTMLButtonElement | undefined;
    expect(toggle).toBeDefined();
    expect(toggle?.disabled).toBe(false);
  });

  it('Mod+. collapses both panels when wide and closes the open overlay when narrow', async () => {
    await show(adapter());
    const sides = () =>
      ['left', 'right'].map((s) =>
        container.querySelector(`[data-side="${s}"]`)?.getAttribute('data-collapsed'),
      );
    await press({ key: '.', ctrlKey: true });
    expect(sides()).toEqual(['true', 'true']);
    await press({ key: '.', ctrlKey: true });
    expect(sides()).not.toContain('true');

    await act(async () => root.unmount());
    root = createRoot(container);
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900);
    try {
      await show(adapter());
      const left = () => container.querySelector<HTMLElement>('[data-side="left"]');
      expect(left()?.hidden).toBe(true);
      await press({ key: '.', ctrlKey: true });
      expect(left()?.hidden).toBe(false);
      await press({ key: '.', ctrlKey: true });
      expect(left()?.hidden).toBe(true);
    } finally {
      width.mockRestore();
    }
  });

  it('remembers a collapsed panel', async () => {
    await show(adapter());
    const collapse = [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Collapse panel',
    );
    await act(async () => collapse?.click());
    const side = () => container.querySelector('[data-side="left"]');
    expect(side()?.getAttribute('data-collapsed')).toBe('true');
    await act(async () => root.unmount());
    root = createRoot(container);
    await show(adapter());
    expect(side()?.getAttribute('data-collapsed')).toBe('true');
  });
});
