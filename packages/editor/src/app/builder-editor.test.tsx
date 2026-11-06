// @vitest-environment jsdom
import type { RegistryManifest } from '@next-buildr/core';
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
import { useShellPanels } from './shell-panels.tsx';
import { useStageSlots } from './stage-slots.tsx';

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
    expect($('main section').getAttribute('aria-label')).toBe(en['issues.drawer']);
    expect($('.bd-status').getAttribute('aria-label')).toBe(en['statusBar.label']);
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
    for (const value of Object.values(pl)) {
      expect(value).not.toMatch(/\p{L}\?+\p{L}|\?+\p{L}|\p{L}\?{2,}/u);
    }
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

  it('shows and hides the issues drawer, which sits inside the stage', async () => {
    await show(props());
    const toggle = container.querySelector<HTMLButtonElement>('.bd-status button[aria-expanded]');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect($('main .bd-issues').getAttribute('data-open')).toBe('false');
    expect(container.querySelector('.bd-status .bd-issues')).toBeNull();
    await act(async () => toggle?.click());
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect($('main .bd-issues').getAttribute('data-open')).toBe('true');
    expect(toggle?.getAttribute('aria-controls')).toBe($('main .bd-issues').id);
    await act(async () => toggle?.click());
    expect($('main .bd-issues').getAttribute('data-open')).toBe('false');
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

  const renderLayout = (locale: string, node: React.ReactNode) =>
    act(async () => root.render(<MessagesProvider locale={locale}>{node}</MessagesProvider>));

  it('words the issue counts with plural forms, in English', async () => {
    await renderLayout(
      'en',
      <EditorLayout issueCounts={{ error: 1, warning: 3 }} status={<span>info</span>} />,
    );
    const toggle = $('.bd-status button[aria-expanded]');
    expect(toggle.querySelector('[data-severity=error]')?.textContent).toBe('1 error');
    expect(toggle.querySelector('[data-severity=warning]')?.textContent).toBe('3 warnings');
    expect($('.bd-status').textContent).toContain('info');
    await renderLayout('en', <EditorLayout issueCounts={{ error: 0, warning: 0 }} />);
    expect($('.bd-status button[aria-expanded]').textContent).toBe(en['statusBar.noIssues']);
  });

  it('counts notes in the status bar and reports no issues only when all three are zero', async () => {
    await renderLayout('en', <EditorLayout issueCounts={{ error: 0, warning: 0, info: 2 }} />);
    const toggle = $('.bd-status button[aria-expanded]');
    expect(toggle.querySelector('[data-severity=info]')?.textContent).toBe('2 notes');
    expect(toggle.textContent).not.toContain(en['statusBar.noIssues']);
    await renderLayout('en', <EditorLayout issueCounts={{ error: 0, warning: 0, info: 0 }} />);
    expect($('.bd-status button[aria-expanded]').textContent).toBe(en['statusBar.noIssues']);
    await renderLayout('pl', <EditorLayout issueCounts={{ error: 0, warning: 0, info: 5 }} />);
    expect($('.bd-status [data-severity=info]').textContent).toBe('5 uwag');
  });

  it('words the issue counts with plural forms, in Polish', async () => {
    const text = async (warning: number) => {
      await renderLayout('pl', <EditorLayout issueCounts={{ error: 0, warning }} />);
      return $('.bd-status button[aria-expanded]').textContent;
    };
    expect(await text(1)).toBe('1 ostrzeżenie');
    expect(await text(2)).toBe('2 ostrzeżenia');
    expect(await text(5)).toBe('5 ostrzeżeń');
  });

  it('shows the selection path on the left of the status bar', async () => {
    await renderLayout('en', <EditorLayout breadcrumbs={<nav>path</nav>} />);
    expect($('.bd-status .bd-status-crumbs nav').textContent).toBe('path');
  });

  describe('collapsing the panels', () => {
    let panels: ReturnType<typeof useShellPanels>;
    const Probe = () => {
      panels = useShellPanels();
      return null;
    };
    const layout = () => (
      <EditorLayout
        toolbar={<Probe />}
        left={<p id="left-content">left</p>}
        right={<p id="right-content">right</p>}
      />
    );
    const KEY = 'buildr:editor:collapsed';

    it('shrinks a collapsed panel to a rail, keeps its content mounted and remembers it', async () => {
      await renderLayout('en', layout());
      expect($('.bd-body').style.getPropertyValue('--bd-left')).toBe('280px');
      expect(container.querySelector('.bd-rail')).toBeNull();
      expect(panels?.leftTab).toBe('blocks');

      await act(async () => panels?.toggleCollapsed?.('left'));
      expect($('.bd-body').style.getPropertyValue('--bd-left')).toBe('var(--bd-rail)');
      expect($('aside[data-side=left]').getAttribute('data-collapsed')).toBe('true');
      expect($('aside[data-side=left] .bd-panel-content').hidden).toBe(true);
      expect(container.querySelector('#left-content')).not.toBeNull();
      expect(container.querySelectorAll('aside[data-side=left] .bd-rail button')).toHaveLength(2);
      expect($('.bd-body').style.getPropertyValue('--bd-right')).toBe('320px');
      expect(JSON.parse(window.localStorage.getItem(KEY) ?? '')).toEqual({
        left: true,
        right: false,
      });

      await act(async () => panels?.collapseAll?.());
      expect(container.querySelectorAll('.bd-rail')).toHaveLength(2);
      await act(async () => panels?.expandAll?.());
      expect(container.querySelector('.bd-rail')).toBeNull();
    });

    it('opens a panel from its rail, on the chosen tab', async () => {
      await renderLayout('en', layout());
      await act(async () => panels?.collapseAll?.());
      const structure = container.querySelectorAll<HTMLButtonElement>(
        'aside[data-side=left] .bd-rail button',
      )[1];
      expect(structure?.getAttribute('aria-label')).toBe(en['leftPanel.tab.structure']);
      await act(async () => structure?.click());
      expect(panels?.leftTab).toBe('structure');
      expect(panels?.collapsed).toEqual({ left: false, right: true });
      await act(async () => $('aside[data-side=right] .bd-rail button').click());
      expect(panels?.collapsed).toEqual({ left: false, right: false });
    });

    it('moves focus into an expanded panel and back to the rail on collapse', async () => {
      await renderLayout(
        'en',
        <EditorLayout
          toolbar={<Probe />}
          left={
            <button type="button" id="left-first">
              left
            </button>
          }
          right={
            <button type="button" id="right-first">
              right
            </button>
          }
        />,
      );
      expect(document.activeElement).toBe(document.body);
      await act(async () => panels?.collapseAll?.());
      const rail = $('aside[data-side=right] .bd-rail button');
      rail.focus();
      await act(async () => rail.click());
      expect(document.activeElement).toBe($('#right-first'));
      await act(async () => panels?.toggleCollapsed?.('right'));
      expect(document.activeElement).toBe($('aside[data-side=right] .bd-rail button'));
    });

    it('does not steal focus when restoring a stored collapse', async () => {
      window.localStorage.setItem(KEY, JSON.stringify({ left: true, right: false }));
      await renderLayout('en', layout());
      expect(document.activeElement).toBe(document.body);
    });

    it('restores a stored collapse and ignores corrupt data', async () => {
      window.localStorage.setItem(KEY, JSON.stringify({ left: true, right: 'yes' }));
      await renderLayout('en', layout());
      expect(panels?.collapsed).toEqual({ left: true, right: false });
      for (const bad of ['{not json', 'null', '42', '"left"', '[true,true]']) {
        window.localStorage.setItem(KEY, bad);
        await act(async () => root.unmount());
        root = createRoot(container);
        await renderLayout('en', layout());
        expect(panels?.collapsed).toEqual({ left: false, right: false });
      }
    });

    it('works while the storage throws', async () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('denied');
      });
      await renderLayout('en', layout());
      await act(async () => panels?.toggleCollapsed?.('right'));
      expect(panels?.collapsed).toEqual({ left: false, right: true });
      getItem.mockRestore();
      setItem.mockRestore();
    });

    it('provides the stage and the drawer state to the stage slots', async () => {
      let slots: ReturnType<typeof useStageSlots>;
      const Slots = () => {
        slots = useStageSlots();
        return null;
      };
      await renderLayout('en', <EditorLayout center={<Slots />} />);
      expect(slots?.stage).toBe($('main'));
      expect(slots?.issuesOpen).toBe(false);
      await act(async () => slots?.setIssuesOpen(true));
      expect($('main .bd-issues').getAttribute('data-open')).toBe('true');
    });
  });

  it('turns the panels into toolbar-toggled overlays when the editor is narrow', async () => {
    let notify: ((entries: unknown[]) => void) | undefined;
    const callbacks: ((entries: unknown[]) => void)[] = [];
    class FakeObserver {
      constructor(callback: (entries: unknown[]) => void) {
        callbacks.push(callback);
        notify = (entries) => {
          for (const each of callbacks) each(entries);
        };
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

  it('shows a scrim and closable sheets, opens one at a time and flags a phone-wide editor', async () => {
    let notify: ((entries: unknown[]) => void) | undefined;
    const callbacks: ((entries: unknown[]) => void)[] = [];
    class FakeObserver {
      constructor(callback: (entries: unknown[]) => void) {
        callbacks.push(callback);
        notify = (entries) => {
          for (const each of callbacks) each(entries);
        };
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeObserver);
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390);
    const Toggles = () => (
      <>
        <PanelToggle side="left" />
        <PanelToggle side="right" />
      </>
    );
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <div className="buildr-editor">
            <EditorLayout toolbar={<Toggles />} left={<p>left</p>} right={<p>right</p>} />
          </div>
        </MessagesProvider>,
      ),
    );
    // The page can never grow wider than the window: nothing in the shell has a width of its own.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    expect($('.bd-body').getAttribute('data-compact')).toBe('true');
    expect($('.bd-toolbar').getAttribute('data-compact')).toBe('true');
    expect($('.bd-status').getAttribute('data-compact')).toBe('true');
    expect($('.bd-scrim')).toBeNull();
    const [left, right] = [...document.querySelectorAll<HTMLElement>('.bd-toolbar button')];
    left?.focus();
    await act(async () => left?.click());
    expect($('aside[data-side=left]').hidden).toBe(false);
    expect($('.bd-scrim')).not.toBeNull();
    // The open sheet is a non-modal dialog with a name; focus is inside it, the canvas and status bar are inert and the toolbar stays live.
    const sheet = $('aside[data-side=left]');
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.hasAttribute('aria-modal')).toBe(false);
    expect(sheet.getAttribute('aria-label')).toBe(en['editor.leftPanel']);
    expect(sheet.contains(document.activeElement)).toBe(true);
    expect($('.bd-toolbar').hasAttribute('inert')).toBe(false);
    expect($('.bd-canvas').hasAttribute('inert')).toBe(true);
    expect($('.bd-status').hasAttribute('inert')).toBe(true);
    expect($('aside[data-side=right]').getAttribute('role')).toBeNull();
    // Escape closes it, focus goes back to the button that opened it.
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect($('aside[data-side=left]').hidden).toBe(true);
    expect($('.bd-toolbar').hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(left);
    await act(async () => left?.click());
    // Opening the other one closes it.
    await act(async () => right?.click());
    expect($('aside[data-side=left]').hidden).toBe(true);
    expect($('aside[data-side=right]').hidden).toBe(false);
    // The inspector sheet has its own close button.
    const close = $('aside[data-side=right] .bd-sheet-close');
    expect(close.getAttribute('aria-label')).toBe(en['ui.close']);
    await act(async () => close.click());
    expect($('aside[data-side=right]').hidden).toBe(true);
    // The scrim and Escape (from anywhere) close a sheet too.
    await act(async () => left?.click());
    await act(async () => $('.bd-scrim').click());
    expect($('aside[data-side=left]').hidden).toBe(true);
    await act(async () => right?.click());
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect($('aside[data-side=right]').hidden).toBe(true);
    // A tablet is narrow but not compact.
    await act(async () => notify?.([{ contentRect: { width: 1000 } }]));
    expect($('.bd-body').getAttribute('data-narrow')).toBe('true');
    expect($('.bd-body').getAttribute('data-compact')).toBe('false');
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
    // Only a window too narrow for the toolbar and the canvas is turned away.
    expect(config.minViewportWidth).toBe(320);
    expect(
      resolveConfig({ autosave: { debounceMs: 1, maxWaitMs: 2 }, uiLocale: 'pl' }),
    ).toMatchObject({ autosave: { debounceMs: 1, maxWaitMs: 2 }, uiLocale: 'pl' });
  });
});
