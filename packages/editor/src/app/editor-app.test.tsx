// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  type RegistryManifest,
  toManifest,
} from '@buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentAdapter } from '../persistence/index.ts';
import { EditorApp, type EditorAppProps } from './editor-app.tsx';

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
const document: BuilderDocument = {
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['itemAAAAA1'] } },
    itemAAAAA1: { id: 'itemAAAAA1', type: 'buildr/item', name: 'First' },
  },
  components: { 'buildr/page': 1, 'buildr/item': 1 },
};

const adapter = (overrides: Partial<DocumentAdapter> = {}): DocumentAdapter => ({
  getSession: async () => ({ canEdit: true, canPublish: true }),
  load: async () => ({
    title: 'My page',
    status: 'draft',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1,
    document,
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
    expect(container.querySelector('h1')?.textContent).toBe('My page');
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

  it('offers the Layers tab and does not save an untouched document', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const save = vi.fn(async (_ref: unknown, { baseRevision }: { baseRevision: number }) => ({
        ok: true as const,
        revision: baseRevision + 1,
        updatedAt: '',
      }));
      await show(adapter({ save: save as never }));
      const layers = [...container.querySelectorAll('[role=tab]')].find(
        (tab) => tab.textContent === 'Layers',
      ) as HTMLElement;
      expect(layers).toBeDefined();
      expect(save).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
