// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  type LocaleConfig,
  p,
  s,
  toManifest,
} from '@buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MessagesProvider } from '../messages/index.tsx';
import { Inspector } from '../panels/inspector/index.ts';
import { IssuesPanel } from '../panels/issues/index.ts';
import {
  createEditorStore,
  createLocaleStore,
  EditorStoreProvider,
  LocaleProvider,
  useLocaleState,
} from '../store/index.ts';
import { LocaleSwitcher } from '../toolbar/index.ts';
import { ManifestProvider } from './manifest.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const locales: LocaleConfig = {
  locales: ['en', 'pl', 'de'],
  default: 'en',
  fallback: true,
  intl: { en: 'English', pl: 'Polski', de: 'Deutsch' },
};

const widget: ComponentMeta = {
  type: 'buildr/widget',
  version: 1,
  label: 'Widget',
  category: 'content',
  props: { title: p.text({ label: 'Title', default: 'Hello' }) },
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
  slots: { default: {} },
};
const page: ComponentMeta = {
  ...widget,
  type: 'buildr/page',
  label: 'Page',
  props: {},
  capabilities: { root: true },
};
const registry = createRegistryMeta({ components: [page, widget] });
const manifest = toManifest(registry);

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['widget0001', 'widget0002'] } },
    widget0001: { id: 'widget0001', type: 'buildr/widget', props: { title: s('Hello') } },
    widget0002: {
      id: 'widget0002',
      type: 'buildr/widget',
      props: { title: { kind: 'static', value: 'Bye', l10n: { pl: 'Pa' } } },
    },
  },
  components: { 'buildr/page': 1, 'buildr/widget': 1 },
});

function Harness() {
  const locale = useLocaleState((state) => state.locale);
  return (
    <>
      <LocaleSwitcher />
      <Inspector locale={locale} defaultLocale="en" />
      <IssuesPanel />
    </>
  );
}

describe('content language', () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    Element.prototype.scrollIntoView ??= () => {};
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  const mount = async (select = 'widget0001') => {
    const store = createEditorStore({
      doc: fixture(),
      registry,
      generateId: createSeededIdGenerator(3),
      validationDelayMs: null,
      locales,
    });
    store.select(select);
    const localeStore = createLocaleStore(locales);
    await act(async () => {
      store.validateNow();
      root.render(
        <MessagesProvider locale="en">
          <ManifestProvider manifest={manifest}>
            <EditorStoreProvider store={store}>
              <LocaleProvider store={localeStore}>
                <Harness />
              </LocaleProvider>
            </EditorStoreProvider>
          </ManifestProvider>
        </MessagesProvider>,
      );
    });
    return { store, localeStore };
  };
  const click = (el: Element | null | undefined) =>
    act(async () => {
      (el as HTMLElement).click();
    });
  const button = (name: string) =>
    [...container.querySelectorAll('button')].find((b) => b.textContent === name);
  const l10nOf = (store: ReturnType<typeof createEditorStore>, id: string) =>
    (store.getState().doc.nodes[id]?.props?.['title'] as { l10n?: Record<string, string> })?.l10n;
  const titleInput = () => container.querySelector('[data-prop=title] input') as HTMLInputElement;

  it('is quiet in the default language and explains the split in another', async () => {
    const { localeStore } = await mount();
    expect(container.querySelector('.bd-translation-banner')).toBeNull();
    expect(container.querySelector('.bd-translation-hint')).toBeNull();
    await act(async () => localeStore.getState().setLocale('pl'));
    expect(container.querySelector('.bd-translation-banner')?.textContent).toContain(
      'Structure and style are shared',
    );
    expect(container.querySelector('[data-prop=title][data-untranslated]')).not.toBeNull();
    expect(container.textContent).toContain('The default-language text is shown.');
  });

  it('translating writes to l10n; undo and removing take it back', async () => {
    const { store, localeStore } = await mount();
    await act(async () => localeStore.getState().setLocale('pl'));
    await click(button('Translate'));
    expect(l10nOf(store, 'widget0001')).toEqual({ pl: 'Hello' });
    expect(container.querySelector('[data-untranslated]')).toBeNull();
    expect(button('Translate')).toBeUndefined();

    await act(async () => {
      store.undo();
    });
    expect(l10nOf(store, 'widget0001')).toBeUndefined();

    await click(button('Translate'));
    await click(button('Remove translation'));
    expect(l10nOf(store, 'widget0001')).toBeUndefined();
    // The default-language value is untouched by all of it.
    expect(
      (store.getState().doc.nodes['widget0001']?.props?.['title'] as { value: string } | undefined)
        ?.value,
    ).toBe('Hello');
  });

  it('shows the translation of the chosen language, and ignores an unknown one', async () => {
    const { localeStore } = await mount('widget0002');
    expect(titleInput().value).toBe('Bye');
    await act(async () => localeStore.getState().setLocale('pl'));
    expect(titleInput().value).toBe('Pa');
    await act(async () => localeStore.getState().setLocale('de'));
    expect(titleInput().value).toBe('Bye');
    await act(async () => localeStore.getState().setLocale('xx'));
    expect(localeStore.getState().locale).toBe('de');
  });

  it('lists missing translations per language', async () => {
    await mount();
    const groups = [...container.querySelectorAll('.bd-issues-group')].map((group) => ({
      locale: group.getAttribute('data-locale'),
      count: group.querySelectorAll('li').length,
    }));
    // widget0001 has no translation at all; widget0002 lacks only German.
    expect(groups).toEqual([
      { locale: 'pl', count: 1 },
      { locale: 'de', count: 2 },
    ]);
    expect(container.querySelector('.bd-issues-group summary')?.textContent).toContain(
      'Missing translations: Polski',
    );
  });

  it('shows no switcher for a single language', async () => {
    const single: LocaleConfig = {
      locales: ['en'],
      default: 'en',
      fallback: true,
      intl: { en: 'English' },
    };
    const store = createLocaleStore(single);
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <LocaleProvider store={store}>
            <LocaleSwitcher />
          </LocaleProvider>
        </MessagesProvider>,
      ),
    );
    expect(container.innerHTML).toBe('');
  });
});
