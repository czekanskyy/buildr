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
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { MessagesProvider } from '../messages/index.tsx';
import {
  createPersistence,
  type DocumentAdapter,
  type PersistenceController,
  PersistenceProvider,
} from '../persistence/index.ts';
import { ShortcutProvider } from '../shortcuts/index.ts';
import { createEditorStore, EditorStoreProvider } from '../store/index.ts';
import { ThemeProvider, type ThemeState } from './theme.tsx';
import { Toolbar, type ToolbarProps } from './toolbar.tsx';

expect.extend(matchers);

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
    root: { id: 'root', type: 'buildr/page', slots: { default: ['itemAAAAA1'] } },
    itemAAAAA1: { id: 'itemAAAAA1', type: 'buildr/item' },
  },
  components: {},
});

const adapter = {
  save: async () => ({ ok: true, revision: 2, updatedAt: 't2' }),
} as unknown as DocumentAdapter;

const breakpoints = [
  { id: 'desktop', width: 1280 },
  { id: 'tablet', width: 820 },
  { id: 'mobile', width: 390 },
];

describe('Toolbar', () => {
  let container: HTMLElement;
  let root: Root;
  let controller: PersistenceController;

  const buttons = () => [...container.querySelectorAll('button')];
  const byName = (name: string) =>
    buttons().find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(name));

  async function mount(
    overrides: Partial<ToolbarProps> = {},
    options: { readOnly?: boolean; theme?: ThemeState } = {},
  ) {
    const store = createEditorStore({
      doc: fixture(),
      registry: registryMeta,
      generateId: createSeededIdGenerator(3),
      validationDelayMs: null,
    });
    if (options.readOnly === true) store.setReadOnly(true);
    controller = createPersistence({
      store,
      adapter,
      ref: { collection: 'pages', id: '1' },
      revision: 1,
    });
    const props: ToolbarProps = {
      title: 'Home',
      breakpoints,
      breakpoint: 'desktop',
      onBreakpointChange: () => undefined,
      ...overrides,
    };
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <EditorStoreProvider store={store}>
            <ShortcutProvider platform="other">
              <PersistenceProvider controller={controller}>
                <ThemeProvider value={options.theme}>
                  <div role="toolbar" aria-label="Toolbar">
                    <Toolbar {...props} />
                  </div>
                </ThemeProvider>
              </PersistenceProvider>
            </ShortcutProvider>
          </EditorStoreProvider>
        </MessagesProvider>,
      ),
    );
    return store;
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

  it('shows the title and switches the breakpoint', async () => {
    const onBreakpointChange = vi.fn();
    await mount({ onBreakpointChange, breakpoint: 'tablet' });
    expect(container.querySelector('h1')?.textContent).toBe('Home');
    expect(byName('Tablet')?.getAttribute('aria-pressed')).toBe('true');
    expect(byName('Desktop')?.getAttribute('aria-pressed')).toBe('false');
    await act(async () => byName('Mobile')?.click());
    expect(onBreakpointChange).toHaveBeenCalledWith('mobile');
  });

  it('enables undo and redo only when there is something to undo or redo', async () => {
    const store = await mount();
    const undo = () => byName('Undo') as HTMLButtonElement;
    const redo = () => byName('Redo') as HTMLButtonElement;
    expect(undo().disabled).toBe(true);
    expect(redo().disabled).toBe(true);
    await act(async () => {
      store.dispatch({
        type: 'node.setAttr',
        payload: { id: 'itemAAAAA1', key: 'name', value: 'a' },
      });
    });
    expect(undo().disabled).toBe(false);
    await act(async () => undo().click());
    expect(undo().disabled).toBe(true);
    expect(redo().disabled).toBe(false);
    await act(async () => redo().click());
    expect(store.getState().doc.nodes['itemAAAAA1']?.name).toBe('a');
  });

  it('disables undo and redo of a read-only document', async () => {
    await mount({}, { readOnly: true });
    expect((byName('Undo') as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain('Read only');
  });

  it('shows the save status', async () => {
    const store = await mount();
    expect(container.querySelector('[role=status]')?.textContent).toContain('All changes saved');
    await act(async () => {
      store.dispatch({
        type: 'node.setAttr',
        payload: { id: 'itemAAAAA1', key: 'name', value: 'a' },
      });
    });
    expect(container.querySelector('[role=status]')?.textContent).toContain('Unsaved changes');
  });

  it('calls preview and publish, which are off without a handler or the right', async () => {
    const onPreview = vi.fn();
    const onPublish = vi.fn();
    await mount({ onPreview, onPublish });
    await act(async () => byName('Preview')?.click());
    await act(async () => byName('Publish')?.click());
    expect(onPreview).toHaveBeenCalledOnce();
    expect(onPublish).toHaveBeenCalledOnce();

    await mount({ onPublish, canPublish: false });
    expect((byName('Publish') as HTMLButtonElement).disabled).toBe(true);
    expect((byName('Preview') as HTMLButtonElement).disabled).toBe(true);
  });

  it('links to the CMS and the version history only when it has them', async () => {
    await mount();
    expect(container.querySelector('a')).toBeNull();
    await mount({ cmsUrl: '/admin/pages/1', historyUrl: '/admin/pages/1/versions' });
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/admin/pages/1',
      '/admin/pages/1/versions',
    ]);
    expect(links[0]?.getAttribute('aria-label')).toBe('Back to CMS');
    expect(links[1]?.getAttribute('aria-label')).toBe('Version history');
  });

  it('has no accessibility violations', async () => {
    await mount({
      cmsUrl: '/admin',
      historyUrl: '/versions',
      onPreview: () => undefined,
      onPublish: () => undefined,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names the buttons without the shortcuts, which appear in the tooltips', async () => {
    await mount();
    const undo = byName('Undo') as HTMLButtonElement;
    expect(undo.getAttribute('aria-label')).toBe('Undo');
    await act(async () => {
      undo.focus();
      undo.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    // Radix opens the tooltip on keyboard focus; its text carries the shortcut.
    const tip = document.querySelector('[role=tooltip]');
    expect(tip?.textContent).toContain('Ctrl+Z');
  });

  const menuButtons = () => [...document.querySelectorAll('.bd-menu-list button')];
  const openMore = async () =>
    act(async () => (byName('More actions') as HTMLButtonElement).click());

  it('shows the breakpoints as icon buttons with the width in the tooltip', async () => {
    await mount({ breakpoint: 'tablet' });
    const tablet = byName('Tablet') as HTMLButtonElement;
    expect(tablet.textContent).toBe('');
    expect(tablet.querySelector('svg')).not.toBeNull();
    await act(async () => {
      tablet.focus();
      tablet.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(document.querySelector('[role=tooltip]')?.textContent).toContain('Tablet · 820px');
  });

  it('shows the status pill of the document', async () => {
    await mount({ status: 'published' });
    expect(container.querySelector('.bd-status-pill')?.textContent).toBe('Published');
  });

  it('changes the zoom through the menu', async () => {
    const onZoomChange = vi.fn();
    await mount({ onZoomChange, zoom: 'fit' });
    const trigger = byName('Zoom') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('Zoom: Fit');
    await act(async () => trigger.click());
    expect(menuButtons().map((b) => b.textContent)).toEqual(['Fit', '50%', '75%', '100%', '125%']);
    await act(async () =>
      (menuButtons().find((b) => b.textContent === '75%') as HTMLButtonElement).click(),
    );
    expect(onZoomChange).toHaveBeenCalledWith(0.75);
  });

  it('leaves the zoom menu out without a handler', async () => {
    await mount();
    expect(byName('Zoom')).toBeUndefined();
  });

  it('keeps every action reachable in a narrow row by moving them into the more menu', async () => {
    // jsdom has no layout: the row overflows until the toolbar has collapsed every step.
    const proto = HTMLElement.prototype;
    const client = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    const scroll = Object.getOwnPropertyDescriptor(proto, 'scrollWidth');
    Object.defineProperty(proto, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('bd-toolbar-row') ? 1024 : 0;
      },
    });
    Object.defineProperty(proto, 'scrollWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (!this.classList.contains('bd-toolbar-row')) return 0;
        return 1024 + (4 - Number(this.getAttribute('data-level'))) * 100;
      },
    });
    try {
      await mount({ cmsUrl: '/admin', historyUrl: '/versions', onPreview: () => undefined });
      expect(container.querySelector('.bd-toolbar-row')?.getAttribute('data-level')).toBe('4');
      expect(container.querySelector('a')).toBeNull();
      await openMore();
      const links = [...document.querySelectorAll('.bd-menu-list a')];
      expect(links.map((a) => a.getAttribute('href'))).toEqual(['/admin', '/versions']);
      expect(document.querySelector('.bd-menu-list')?.textContent).toContain('Keyboard shortcuts');
      for (const name of ['Undo', 'Redo', 'Desktop', 'Tablet', 'Mobile', 'Preview', 'Publish']) {
        expect(byName(name)).toBeDefined();
      }
    } finally {
      if (client !== undefined) Object.defineProperty(proto, 'clientWidth', client);
      else Reflect.deleteProperty(proto, 'clientWidth');
      if (scroll !== undefined) Object.defineProperty(proto, 'scrollWidth', scroll);
      else Reflect.deleteProperty(proto, 'scrollWidth');
    }
  });

  it('opens the shortcut help from the more menu', async () => {
    await mount();
    await openMore();
    const item = menuButtons().find((b) => (b.textContent ?? '').includes('Keyboard shortcuts'));
    await act(async () => (item as HTMLButtonElement).click());
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Keyboard shortcuts');
  });

  it('switches the theme from the more menu, unless the host fixed it', async () => {
    const setPreference = vi.fn();
    const theme: ThemeState = {
      preference: 'system',
      attribute: 'system',
      forced: false,
      setPreference,
    };
    await mount({}, { theme });
    await openMore();
    const group = document.querySelector('[aria-label=Theme]');
    const choice = (name: string) =>
      [...(group?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes(name));
    expect(choice('System')?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => (choice('Dark') as HTMLButtonElement).click());
    expect(setPreference).toHaveBeenCalledWith('dark');

    await act(async () => root.unmount());
    root = createRoot(container);
    await mount({}, { theme: { ...theme, forced: true, preference: 'dark', attribute: 'dark' } });
    await openMore();
    expect(document.querySelector('[aria-label=Theme]')).toBeNull();
  });
});
