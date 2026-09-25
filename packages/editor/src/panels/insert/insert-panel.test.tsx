// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  defineTemplate,
  p,
  s,
  toManifest,
} from '@buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { ManifestProvider } from '../../app/manifest.tsx';
import { MessagesProvider } from '../../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../../store/index.ts';
import { filterItems, paletteItems, safeThumbnail } from './catalog.ts';
import { InsertPanel } from './insert-panel.tsx';

expect.extend(matchers);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const meta = (type: string, overrides: Partial<ComponentMeta> = {}): ComponentMeta => ({
  type,
  version: 1,
  label: type.split('/')[1] ?? type,
  category: 'content',
  props: {},
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
  ...overrides,
});

const registry = createRegistryMeta({
  components: [
    meta('buildr/page', {
      capabilities: { root: true },
      slots: { default: { max: 2 } },
    }),
    meta('buildr/box', {
      label: 'Box',
      category: 'layout',
      icon: 'layout-grid',
      slots: { default: {} },
    }),
    meta('buildr/text', {
      label: 'Text',
      icon: 'no-such-lucide-icon',
      keywords: ['paragraph', 'copy'],
      props: { text: p.text({ default: '' }) },
    }),
    meta('buildr/hidden', { label: 'Hidden', capabilities: { insertable: false } }),
  ],
  templates: [
    defineTemplate({
      id: 'site/hero',
      version: 1,
      label: 'Hero',
      category: 'sections',
      thumbnail: '/thumbs/hero.png',
      lock: 'none',
      tree: { type: 'buildr/box', children: [{ type: 'buildr/text' }] },
    }),
    defineTemplate({
      id: 'site/evil',
      version: 1,
      label: 'Evil',
      category: 'sections',
      thumbnail: 'javascript:alert(1)',
      lock: 'none',
      tree: { type: 'buildr/box' },
    }),
  ],
});
const manifest = toManifest(registry);

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['boxNode001', 'boxNode002'] } },
    boxNode001: { id: 'boxNode001', type: 'buildr/box', slots: { default: ['textNodeA1'] } },
    boxNode002: { id: 'boxNode002', type: 'buildr/box' },
    textNodeA1: { id: 'textNodeA1', type: 'buildr/text', props: { text: s('A') } },
  },
  components: {},
});

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

async function mount(readOnly = false) {
  const store = createEditorStore({
    doc: fixture(),
    registry,
    generateId: createSeededIdGenerator(5),
    validationDelayMs: null,
    readOnly,
  });
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <ManifestProvider manifest={manifest}>
          <EditorStoreProvider store={store}>
            <InsertPanel />
          </EditorStoreProvider>
        </ManifestProvider>
      </MessagesProvider>,
    ),
  );
  return store;
}

const button = (label: string) =>
  [...container.querySelectorAll('button')].find(
    (b) => b.querySelector('.bd-insert-label')?.textContent === label,
  ) as HTMLElement;
const click = (label: string) => act(async () => button(label).click());
const notice = () => container.querySelector('[role=status]')?.textContent;
const children = (store: Awaited<ReturnType<typeof mount>>, id: string) =>
  store.getState().doc.nodes[id]?.slots?.['default'] ?? [];

describe('tile icons', () => {
  it('draws an svg for a known icon and the neutral box for an unknown one, never a letter', async () => {
    await mount();
    const icon = (label: string) => button(label).querySelector('.bd-insert-icon');
    expect(icon('Box')?.querySelector('svg')?.getAttribute('data-icon')).toBe('layout-grid');
    const fallback = icon('Text')?.querySelector('svg');
    expect(fallback?.getAttribute('data-icon')).toBe('box');
    expect(fallback?.getAttribute('data-fallback')).toBe('true');
    expect(icon('Text')?.textContent).toBe('');
  });
});

describe('catalog', () => {
  it('lists only what can be inserted, sorted, with templates apart', () => {
    const { components, templates } = paletteItems(manifest);
    expect(components.map((c) => c.label)).toEqual(['Box', 'Text']);
    expect(templates.map((t) => t.label)).toEqual(['Evil', 'Hero']);
  });

  it('searches by label, type, keyword and every word', () => {
    const { components } = paletteItems(manifest);
    expect(filterItems(components, 'para').map((c) => c.label)).toEqual(['Text']);
    expect(filterItems(components, 'BUILDR/box').map((c) => c.label)).toEqual(['Box']);
    expect(filterItems(components, 'copy text').map((c) => c.label)).toEqual(['Text']);
    expect(filterItems(components, 'copy box')).toEqual([]);
    expect(filterItems(components, '  ')).toHaveLength(2);
  });

  it('shows a thumbnail only when it is an image address', () => {
    expect(safeThumbnail('/thumbs/a.png')).toBe('/thumbs/a.png');
    expect(safeThumbnail('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(safeThumbnail('data:image/png;base64,AAAA')).toBeDefined();
    expect(safeThumbnail('javascript:alert(1)')).toBeUndefined();
    expect(safeThumbnail('//evil.example.com/a.png')).toBeUndefined();
    expect(safeThumbnail('data:text/html,<script>')).toBeUndefined();
    expect(safeThumbnail(undefined)).toBeUndefined();
  });
});

describe('InsertPanel', () => {
  it('is accessible and groups by category', async () => {
    await mount();
    expect(await axe(container)).toHaveNoViolations();
    const groups = [...container.querySelectorAll('[role=group]')].map((g) =>
      g.getAttribute('aria-label'),
    );
    expect(groups).toEqual(['Layout', 'Content', 'Sections']);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/thumbs/hero.png');
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('inserts into the selected container, at the end, and selects the new node', async () => {
    const store = await mount();
    await act(async () => store.select('boxNode001'));
    await click('Text');
    const kids = children(store, 'boxNode001');
    expect(kids).toHaveLength(2);
    expect(kids[0]).toBe('textNodeA1');
    expect(store.getState().doc.nodes[kids[1] as string]?.type).toBe('buildr/text');
    expect(store.getState().selectedIds).toEqual([kids[1]]);
    expect(notice()).toBe('Inserted: Text');
    expect(store.getState().undoLabel).toBe('node.insert');
  });

  it('inserts after a selection that cannot hold children', async () => {
    const store = await mount();
    await act(async () => store.select('textNodeA1'));
    await click('Box');
    const kids = children(store, 'boxNode001');
    expect(kids).toHaveLength(2);
    expect(kids[0]).toBe('textNodeA1');
    expect(store.getState().doc.nodes[kids[1] as string]?.type).toBe('buildr/box');
  });

  it('inserts a template as one undo step', async () => {
    const store = await mount();
    await act(async () => store.select('boxNode002'));
    await click('Hero');
    const [box] = children(store, 'boxNode002');
    const inserted = store.getState().doc.nodes[box as string];
    expect(inserted?.type).toBe('buildr/box');
    expect(inserted?.source).toEqual({ template: 'site/hero', version: 1 });
    await act(async () => store.undo());
    expect(children(store, 'boxNode002')).toEqual([]);
  });

  it('says why when there is no place for it', async () => {
    const store = await mount();
    // The page holds two children at most, and nothing is selected, so there is nowhere to go.
    await click('Box');
    expect(notice()).toContain('cannot be inserted here');
    expect(notice()?.length).toBeGreaterThan('It cannot be inserted here.'.length);
    expect(children(store, 'root')).toHaveLength(2);
  });

  it('does nothing to a read-only document', async () => {
    const store = await mount(true);
    await act(async () => store.select('boxNode002'));
    await click('Text');
    expect(notice()).toBe('The page is read-only.');
    expect(children(store, 'boxNode002')).toEqual([]);
  });

  it('filters while typing and says when nothing matches', async () => {
    await mount();
    const input = container.querySelector('input') as HTMLInputElement;
    const type = async (value: string) =>
      act(async () => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        set?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    await type('paragraph');
    expect(container.querySelectorAll('.bd-insert-item')).toHaveLength(1);
    await type('zzzz');
    expect(container.querySelector('.bd-insert-empty')?.textContent).toBe(
      'Nothing matches the search.',
    );
  });

  it('is operable with the keyboard alone (real buttons in tab order)', async () => {
    await mount();
    const items = [...container.querySelectorAll('.bd-insert-item')] as HTMLButtonElement[];
    expect(items.length).toBe(4);
    for (const item of items) {
      expect(item.tagName).toBe('BUTTON');
      expect(item.tabIndex).toBe(0);
    }
  });
});

describe('InsertPanel (PB-125)', () => {
  const press = (target: EventTarget, key: string) =>
    act(async () => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    });
  const named = (name: string) =>
    [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === name,
    ) as HTMLElement;

  it('collapses a category and reports it with aria-expanded and a count', async () => {
    await mount();
    const toggle = [...container.querySelectorAll('.bd-insert-category-toggle')].find((b) =>
      b.textContent?.includes('Layout'),
    ) as HTMLElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.querySelector('.bd-insert-count')?.textContent).toBe('1');
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const list = container.querySelector(`#${toggle.getAttribute('aria-controls')}`) as HTMLElement;
    expect(list.hidden).toBe(true);
    await act(async () => toggle.click());
    expect(list.hidden).toBe(false);
  });

  it('remembers the list view', async () => {
    localStorage.removeItem('buildr.editor.insert.view');
    await mount();
    expect(container.querySelector('.bd-insert')?.getAttribute('data-view')).toBe('grid');
    await act(async () => named('List view').click());
    expect(container.querySelector('.bd-insert')?.getAttribute('data-view')).toBe('list');
    expect(named('List view').getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('buildr.editor.insert.view')).toBe('list');
    act(() => root.unmount());
    root = createRoot(container);
    await mount();
    expect(container.querySelector('.bd-insert')?.getAttribute('data-view')).toBe('list');
    localStorage.removeItem('buildr.editor.insert.view');
  });

  it('focuses the search on "/" only when no text field has focus', async () => {
    await mount();
    const search = container.querySelector('input') as HTMLInputElement;
    await press(document.body, '/');
    expect(document.activeElement).toBe(search);
    // While typing in the search the key is just a character.
    const typed = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    search.dispatchEvent(typed);
    expect(typed.defaultPrevented).toBe(false);
    const other = document.createElement('input');
    document.body.append(other);
    other.focus();
    await press(other, '/');
    expect(document.activeElement).toBe(other);
  });

  it('clears the search with the clear button', async () => {
    await mount();
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      set?.call(input, 'zzzz');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => named('Clear search').click());
    expect(input.value).toBe('');
    expect(container.querySelector('.bd-insert-empty')).toBeNull();
  });
});
