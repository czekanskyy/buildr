// @vitest-environment jsdom
import type { RegistryManifest } from '@buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { en } from '../messages/en.ts';
import { createTranslator, MessagesProvider, UI_LOCALES } from '../messages/index.tsx';
import { pl } from '../messages/pl.ts';
import { PanelToggle } from '../toolbar/panel-toggles.tsx';
import { BuilderEditor } from './builder-editor.tsx';
import { type BuilderEditorProps, resolveConfig } from './config.ts';
import { EditorLayout } from './layout.tsx';

expect.extend(matchers);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const manifest = {
  manifestVersion: 1,
  components: [],
  templates: [],
} as unknown as RegistryManifest;
const props = (overrides: Partial<BuilderEditorProps> = {}): BuilderEditorProps => ({
  adapter: {} as unknown as BuilderEditorProps['adapter'],
  manifest,
  canvasUrl: '/buildr/canvas',
  documentRef: { collection: 'pages', id: '1' },
  ...overrides,
});

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const show = async (p: BuilderEditorProps) => {
  await act(async () => root.render(<BuilderEditor {...p} />));
};
const $ = (selector: string) => container.querySelector(selector) as HTMLElement;
const key = (el: Element | undefined, k: string) =>
  act(async () => {
    el?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  });

describe('BuilderEditor shell', () => {
  it('renders the regions, each with a translated name', async () => {
    await show(props());
    expect($('[role=toolbar]').getAttribute('aria-label')).toBe(en['editor.toolbar']);
    expect($('main').getAttribute('aria-label')).toBe(en['editor.canvas']);
    const asides = [...container.querySelectorAll('aside')].map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(asides).toEqual([en['editor.leftPanel'], en['editor.inspector']]);
    expect($('section').getAttribute('aria-label')).toBe(en['editor.issues']);
  });

  it('speaks the configured interface language, and English for one it does not know', async () => {
    await show(props({ config: { uiLocale: 'pl' } }));
    expect($('[role=toolbar]').getAttribute('aria-label')).toBe(pl['editor.toolbar']);
    expect($('.buildr-editor').getAttribute('lang')).toBe('pl');
    await show(props({ config: { uiLocale: 'xx' } }));
    expect($('[role=toolbar]').getAttribute('aria-label')).toBe(en['editor.toolbar']);
  });

  it('has a Polish translation for every English string', () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(pl[k]).not.toBe('');
    expect(UI_LOCALES).toEqual(['en', 'pl']);
    expect(createTranslator('pl-PL')('ui.close')).toBe(pl['ui.close']);
  });

  it('forces a colour scheme when asked, and otherwise follows the system', async () => {
    await show(props({ config: { theme: 'dark' } }));
    expect($('.buildr-editor').getAttribute('data-theme')).toBe('dark');
    await show(props());
    expect($('.buildr-editor').hasAttribute('data-theme')).toBe(false);
  });

  it('resizes the panels with the keyboard, within limits', async () => {
    await show(props());
    const [left, right] = container.querySelectorAll<HTMLElement>('[role=separator]');
    expect(left?.getAttribute('aria-valuenow')).toBe('280');
    await key(left, 'ArrowRight');
    expect(left?.getAttribute('aria-valuenow')).toBe('296');
    expect($('.bd-body').style.getPropertyValue('--bd-left')).toBe('296px');
    await key(left, 'Home');
    expect(left?.getAttribute('aria-valuenow')).toBe('200');
    await key(left, 'ArrowLeft');
    expect(left?.getAttribute('aria-valuenow')).toBe('200');

    // The right panel grows when its splitter moves left.
    await key(right, 'ArrowLeft');
    expect(right?.getAttribute('aria-valuenow')).toBe('336');
  });

  it('resizes the panels by dragging', async () => {
    await show(props());
    const left = container.querySelector<HTMLElement>('[role=separator]');
    const pointer = (type: string, x: number) =>
      act(async () => {
        left?.dispatchEvent(new MouseEvent(type, { clientX: x, bubbles: true }));
      });
    await pointer('pointerdown', 100);
    expect(left?.getAttribute('data-dragging')).toBe('true');
    await pointer('pointermove', 160);
    expect(left?.getAttribute('aria-valuenow')).toBe('340');
    await pointer('pointermove', 900);
    expect(left?.getAttribute('aria-valuenow')).toBe('480');
    await pointer('pointerup', 900);
    expect(left?.getAttribute('data-dragging')).toBe('false');
  });

  it('shows and hides the issues panel', async () => {
    await show(props());
    const toggle = container.querySelector<HTMLButtonElement>('.bd-issues button');
    expect(toggle?.textContent).toBe(en['editor.issues.show']);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    await act(async () => toggle?.click());
    expect(toggle?.textContent).toBe(en['editor.issues.hide']);
    expect($('.bd-issues').getAttribute('data-open')).toBe('true');
  });

  it('resets a panel on double-click and remembers the widths', async () => {
    await show(props());
    const [left] = container.querySelectorAll<HTMLElement>('[role=separator]');
    await key(left, 'ArrowRight');
    expect(window.localStorage.getItem('buildr:editor:left-width')).toBe('296');
    await act(async () => {
      left?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(left?.getAttribute('aria-valuenow')).toBe('280');
    expect(window.localStorage.getItem('buildr:editor:left-width')).toBe('280');

    window.localStorage.setItem('buildr:editor:left-width', '400');
    await act(async () => root.unmount());
    root = createRoot(container);
    await show(props());
    expect(container.querySelector('[role=separator]')?.getAttribute('aria-valuenow')).toBe('400');
  });

  it('works without storage', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    await show(props());
    const [left] = container.querySelectorAll<HTMLElement>('[role=separator]');
    await key(left, 'ArrowRight');
    expect(left?.getAttribute('aria-valuenow')).toBe('296');
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('shows the issue counts on the status bar toggle', async () => {
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <EditorLayout issueCounts={{ error: 2, warning: 3 }} status={<span>info</span>} />
        </MessagesProvider>,
      ),
    );
    const toggle = container.querySelector<HTMLButtonElement>('.bd-issues button');
    expect(toggle?.querySelector('[data-severity=error]')?.textContent).toBe('2');
    expect(toggle?.querySelector('[data-severity=warning]')?.textContent).toBe('3');
    expect(toggle?.textContent).toContain(en['editor.issues.show']);
    expect($('.bd-issues-bar').textContent).toContain('info');
    await act(async () => toggle?.click());
    expect($('.bd-issues').getAttribute('data-open')).toBe('true');
  });

  it('turns the panels into toolbar-toggled overlays when the editor is narrow', async () => {
    let notify: ((entries: unknown[]) => void) | undefined;
    class FakeObserver {
      constructor(callback: (entries: unknown[]) => void) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeObserver);
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1300);
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <div className="buildr-editor">
            <EditorLayout toolbar={<PanelToggle side="left" />} />
          </div>
        </MessagesProvider>,
      ),
    );
    expect($('.bd-body').getAttribute('data-narrow')).toBe('false');
    expect(container.querySelector('.bd-toolbar button')).toBeNull();

    await act(async () => notify?.([{ contentRect: { width: 900 } }]));
    expect($('.bd-body').getAttribute('data-narrow')).toBe('true');
    const left = $('aside[data-side=left]');
    expect(left.hidden).toBe(true);
    const button = $('.bd-toolbar button');
    expect(button.getAttribute('aria-label')).toBe(en['editor.panels.left']);
    await act(async () => button.click());
    expect(left.hidden).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    await key(left, 'Escape');
    expect(left.hidden).toBe(true);

    await act(async () => notify?.([{ contentRect: { width: 1300 } }]));
    expect($('.bd-body').getAttribute('data-narrow')).toBe('false');
    width.mockRestore();
    vi.unstubAllGlobals();
  });

  it('has no accessibility violations', async () => {
    await show(props());
    expect(await axe(container)).toHaveNoViolations();
    await show(props({ config: { uiLocale: 'pl', theme: 'dark' } }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('resolveConfig', () => {
  it('fills in the defaults and keeps what the host set', () => {
    const config = resolveConfig();
    expect(config.breakpoints.map((b) => b.id)).toEqual(['desktop', 'tablet', 'mobile']);
    expect(config.autosave).toEqual({ debounceMs: 2000, maxWaitMs: 20_000 });
    expect(
      resolveConfig({ autosave: { debounceMs: 1, maxWaitMs: 2 }, uiLocale: 'pl' }),
    ).toMatchObject({ autosave: { debounceMs: 1, maxWaitMs: 2 }, uiLocale: 'pl' });
  });
});
