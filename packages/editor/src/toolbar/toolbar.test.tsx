// @vitest-environment jsdom

import type { LocaleConfig } from '@next-buildr/core';
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
} from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { type ShellPanels, ShellPanelsContext } from '../app/shell-panels.tsx';
import { MessagesProvider } from '../messages/index.tsx';
import {
  createPersistence,
  type DocumentAdapter,
  type PersistenceController,
  PersistenceProvider,
} from '../persistence/index.ts';
import { ShortcutProvider } from '../shortcuts/index.ts';
import {
  createEditorStore,
  createLocaleStore,
  EditorStoreProvider,
  LocaleProvider,
} from '../store/index.ts';
import { ToastProvider } from '../ui/index.ts';
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
    options: {
      readOnly?: boolean;
      theme?: ThemeState;
      locales?: LocaleConfig;
      panels?: ShellPanels;
    } = {},
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
    const localeStore = createLocaleStore(
      options.locales ?? {
        locales: ['en'],
        default: 'en',
        fallback: true,
        intl: { en: 'English' },
      },
    );
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
              <ToastProvider>
                <PersistenceProvider controller={controller}>
                  <ThemeProvider value={options.theme}>
                    <LocaleProvider store={localeStore}>
                      <ShellPanelsContext.Provider value={options.panels}>
                        <div role="toolbar" aria-label="Toolbar">
                          <Toolbar {...props} />
                        </div>
                      </ShellPanelsContext.Provider>
                    </LocaleProvider>
                  </ThemeProvider>
                </PersistenceProvider>
              </ToastProvider>
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
    expect(byName('Home')?.textContent).toContain('Home');
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
    expect(links[0]?.getAttribute('aria-label')).toBe('Back to the CMS panel');
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
    act(async () => (byName('More options') as HTMLButtonElement).click());

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
    expect(document.querySelector('[role=tooltip]')?.textContent).toContain('Tablet · 820 px');
  });

  it('marks device overrides on the selected node without changing the document', async () => {
    const store = await mount();
    const doc = fixture();
    const node = doc.nodes['itemAAAAA1'];
    if (node === undefined) throw new Error('Missing fixture node');
    const responsive = {
      ...doc,
      nodes: {
        ...doc.nodes,
        itemAAAAA1: {
          ...node,
          styles: { bp: { tablet: { typography: { fontSize: '24px' } } } },
        },
      },
    };
    await act(async () => {
      store.replaceDocument(responsive);
      store.select('itemAAAAA1');
    });
    expect(byName('Tablet')?.getAttribute('data-override')).toBe('true');
    expect(byName('Mobile')?.getAttribute('data-override')).toBe('false');
    expect(byName('Tablet')?.getAttribute('aria-description')).toBe('Overrides for this device');
    expect(store.getState().doc).toEqual(responsive);
    await act(async () => store.select('root'));
    expect(byName('Tablet')?.getAttribute('data-override')).toBe('false');
  });

  it('shows the status pill of the document', async () => {
    await mount({ status: 'published' });
    expect(container.querySelector('.bd-page-chip-status')?.textContent).toBe('Published');
  });

  it('has no zoom control, which lives in the status bar', async () => {
    await mount({ onZoomChange: () => undefined, zoom: 'fit' });
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
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Keyboard shortcuts');
  });

  it('opens the shortcuts through onOpenShortcuts, not by replaying the key', async () => {
    const onOpenShortcuts = vi.fn();
    await mount({ onOpenShortcuts });
    await openMore();
    const item = menuButtons().find((b) => (b.textContent ?? '').includes('Keyboard shortcuts'));
    await act(async () => (item as HTMLButtonElement).click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(onOpenShortcuts).toHaveBeenCalledOnce();
    expect(document.querySelector('[role=dialog]')).toBeNull();
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
    const group = document.querySelector('[aria-label="Editor theme"]');
    const choice = (name: string) =>
      [...(group?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes(name));
    expect(choice('System')?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => (choice('Dark') as HTMLButtonElement).click());
    expect(setPreference).toHaveBeenCalledWith('dark');

    await act(async () => root.unmount());
    root = createRoot(container);
    await mount({}, { theme: { ...theme, forced: true, preference: 'dark', attribute: 'dark' } });
    await openMore();
    expect(document.querySelector('[aria-label="Editor theme"]')).toBeNull();
  });

  const wait = (ms = 10) =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  const dialog = () =>
    document.querySelector('[role=dialog][data-state=open]') as HTMLElement | null;

  it('shows the page chip with the status and opens the page options dialog', async () => {
    await mount({ status: 'draft', slug: 'home' });
    const chip = byName('page options') as HTMLButtonElement;
    expect(chip.getAttribute('aria-label')).toBe('Home – page options');
    expect(chip.getAttribute('aria-haspopup')).toBe('dialog');
    expect(chip.querySelector('.bd-page-chip-status')?.textContent).toBe('Draft');
    expect(dialog()).toBeNull();
    await act(async () => chip.click());
    expect(dialog()?.textContent).toContain('Page options');
  });

  it('renames the page from the dialog through the rename path, address read-only', async () => {
    const onTitleChange = vi.fn(async () => undefined);
    await mount({ onTitleChange, slug: 'home' });
    await act(async () => (byName('page options') as HTMLButtonElement).click());
    const name = dialog()?.querySelector('input[aria-label="Page name"]') as HTMLInputElement;
    expect(name.value).toBe('Home');
    await act(async () => name.focus());
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        name,
        'About',
      );
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onTitleChange).toHaveBeenCalledWith('About');
    const address = [...(dialog()?.querySelectorAll('input') ?? [])].find(
      (input) => input.value === 'home',
    );
    expect(address?.readOnly).toBe(true);
  });

  it('keeps the name read-only without a rename path and closes the dialog on Done', async () => {
    await mount({});
    await act(async () => (byName('page options') as HTMLButtonElement).click());
    const name = dialog()?.querySelector('input') as HTMLInputElement;
    expect(name.readOnly).toBe(true);
    expect(dialog()?.textContent).not.toContain('Address');
    const done = [...(dialog()?.querySelectorAll('button') ?? [])].find(
      (b) => b.textContent === 'Done',
    );
    await act(async () => done?.click());
    await wait(50);
    expect(dialog()).toBeNull();
  });

  const panelsOf = (overrides: Partial<ShellPanels> = {}): ShellPanels => ({
    narrow: false,
    open: { left: false, right: false },
    toggle: vi.fn(),
    collapsed: { left: false, right: true },
    toggleCollapsed: vi.fn(),
    ...overrides,
  });

  it('drives the panel collapse from the toggles when the layout is wide', async () => {
    const panels = panelsOf();
    await mount({}, { panels });
    const left = byName('Left panel') as HTMLButtonElement;
    const right = byName('Inspector panel') as HTMLButtonElement;
    expect(left.getAttribute('aria-pressed')).toBe('true');
    expect(right.getAttribute('aria-pressed')).toBe('false');
    await act(async () => left.click());
    await act(async () => right.click());
    expect(panels.toggleCollapsed).toHaveBeenNthCalledWith(1, 'left');
    expect(panels.toggleCollapsed).toHaveBeenNthCalledWith(2, 'right');
    expect(panels.toggle).not.toHaveBeenCalled();
  });

  it('opens the panels as an overlay when the layout is narrow', async () => {
    const panels = panelsOf({ narrow: true, open: { left: true, right: false } });
    await mount({}, { panels });
    expect((byName('Left panel') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    await act(async () => (byName('Inspector panel') as HTMLButtonElement).click());
    expect(panels.toggle).toHaveBeenCalledWith('right');
    expect(panels.toggleCollapsed).not.toHaveBeenCalled();
  });

  it('puts undo and redo on the left, and the screen size and Publish on the right', async () => {
    await mount({ onPublish: () => undefined });
    const zone = (name: string) => container.querySelector(`[data-zone=${name}]`) as HTMLElement;
    const names = (el: HTMLElement) =>
      [...el.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names(zone('left'))).toEqual(['Undo', 'Redo']);
    expect(names(zone('centre'))).toEqual(['Home – page options']);
    const right = names(zone('right'));
    expect(right.slice(0, 3)).toEqual(['Desktop', 'Tablet', 'Mobile']);
    expect(right.at(-1)).toBe('Publish');
    expect(zone('right').querySelector('.bd-publish svg')).toBeNull();
  });

  const locales: LocaleConfig = {
    locales: ['en', 'pl'],
    default: 'en',
    fallback: true,
    intl: { en: 'English', pl: 'Polski' },
  };

  it('switches the content language from the locale chip', async () => {
    const onLocaleChange = vi.fn();
    await mount({ onLocaleChange }, { locales });
    const chip = byName('Content language') as HTMLButtonElement;
    expect(chip.getAttribute('aria-label')).toBe('Content language: English');
    expect(chip.textContent).toBe('EN');
    await act(async () => chip.click());
    const items = menuButtons();
    expect(items.map((b) => b.textContent)).toEqual(['EnglishEN', 'PolskiPL']);
    expect(items[0]?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => (items[1] as HTMLButtonElement).click());
    expect(onLocaleChange).toHaveBeenCalledWith('pl');
    expect((byName('Content language') as HTMLButtonElement).textContent).toBe('PL');
  });

  it('has no locale chip for a single language', async () => {
    await mount();
    expect(byName('Content language')).toBeUndefined();
  });

  it('lists the more options: theme, shortcuts with its key, no sample data for a page', async () => {
    const theme: ThemeState = {
      preference: 'light',
      attribute: 'light',
      forced: false,
      setPreference: () => undefined,
    };
    await mount({}, { theme });
    await openMore();
    const text = document.querySelector('.bd-menu-list')?.textContent ?? '';
    expect(text).toContain('Editor theme');
    expect(text).toContain('Keyboard shortcuts');
    expect(text).not.toContain('Sample data');
    const shortcuts = menuButtons().find((b) => b.textContent?.includes('Keyboard shortcuts'));
    expect(shortcuts?.querySelector('kbd')?.textContent).toBe('Shift+?');
  });

  it('puts the sample data in the page options and lists it in the more options', async () => {
    const onChange = vi.fn();
    const adapter = { listSamples: async () => [{ id: 's1', label: 'Spring' }] } as never;
    const storage = { getItem: () => 's1', setItem: () => undefined };
    await mount({
      sample: { adapter, docRef: { collection: 'pages', id: '1' }, onChange, storage },
    });
    await wait();
    expect(onChange).toHaveBeenCalledWith('s1');
    await openMore();
    const row = menuButtons().find((b) => b.textContent?.includes('Sample data'));
    expect(row?.querySelector('kbd')?.textContent).toBe('Entry: Spring');
    await act(async () => (row as HTMLButtonElement).click());
    expect(dialog()?.textContent).toContain('Sample data');
    expect(dialog()?.querySelector('[role=combobox]')?.textContent).toContain('Spring');
  });

  it('closes the more menu with Escape', async () => {
    await mount();
    await openMore();
    expect(document.querySelector('.bd-menu-list')).not.toBeNull();
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    await wait(50);
    expect(document.querySelector('.bd-menu-list')).toBeNull();
  });
});
