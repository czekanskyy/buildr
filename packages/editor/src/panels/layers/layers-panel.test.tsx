// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  p,
  s,
  toManifest,
} from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { ManifestProvider } from '../../app/manifest.tsx';
import { MessagesProvider } from '../../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../../store/index.ts';
import { flattenTree } from './flatten.ts';
import { LayersPanel } from './layers-panel.tsx';

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
    meta('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
    meta('buildr/box', { label: 'Box', icon: 'layout-grid', slots: { default: {} } }),
    meta('buildr/text', { label: 'Text', props: { text: p.text({ default: '' }) } }),
  ],
});

const node = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  ...extra,
});

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: node('root', 'buildr/page', { slots: { default: ['boxNode001', 'boxNode002'] } }),
    boxNode001: node('boxNode001', 'buildr/box', {
      name: 'Hero',
      slots: { default: ['textNodeA1', 'textNodeB1'] },
    }),
    boxNode002: node('boxNode002', 'buildr/box', { lock: { content: true } }),
    textNodeA1: node('textNodeA1', 'buildr/text', { props: { text: s('A') } }),
    textNodeB1: node('textNodeB1', 'buildr/text', { props: { text: s('B') } }),
  },
  components: {},
});

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

async function mount(doc: BuilderDocument = fixture()) {
  const store = createEditorStore({
    doc,
    registry,
    generateId: createSeededIdGenerator(9),
    validationDelayMs: null,
  });
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <ManifestProvider manifest={toManifest(registry)}>
          <EditorStoreProvider store={store}>
            <LayersPanel />
          </EditorStoreProvider>
        </ManifestProvider>
      </MessagesProvider>,
    ),
  );
  return store;
}

const tree = () => container.querySelector('[role=tree]') as HTMLElement;
const items = () => [...container.querySelectorAll('[role=treeitem]')] as HTMLElement[];
const labels = () => items().map((item) => item.querySelector('.bd-layer-label')?.textContent);
const press = (key: string, init: KeyboardEventInit = {}) =>
  act(async () => {
    tree().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });

const pick = (store: Awaited<ReturnType<typeof mount>>, id: string) =>
  act(async () => store.select(id));

describe('flattenTree', () => {
  it('lists the visible rows with their ARIA positions', () => {
    const doc = fixture();
    const collapsed = flattenTree(doc, new Set(['root']));
    expect(collapsed.map((r) => [r.id, r.level, r.posInSet, r.setSize, r.expanded])).toEqual([
      ['root', 1, 1, 1, true],
      ['boxNode001', 2, 1, 2, false],
      ['boxNode002', 2, 2, 2, false],
    ]);
    const open = flattenTree(doc, new Set(['root', 'boxNode001']));
    expect(open.map((r) => r.id)).toEqual([
      'root',
      'boxNode001',
      'textNodeA1',
      'textNodeB1',
      'boxNode002',
    ]);
    expect(open[2]).toMatchObject({ level: 3, parentId: 'boxNode001', hasChildren: false });
  });

  it('does not loop on a document that reaches a node twice', () => {
    const doc = fixture();
    const cyclic = {
      ...doc,
      nodes: {
        ...doc.nodes,
        boxNode002: node('boxNode002', 'buildr/box', { slots: { default: ['root'] } }),
      },
    } as BuilderDocument;
    const rows = flattenTree(cyclic, new Set(['root', 'boxNode002']));
    expect(rows.map((r) => r.id)).toEqual(['root', 'boxNode001', 'boxNode002']);
  });
});

describe('LayersPanel', () => {
  it('is an ARIA tree with names from the manifest and no accessibility violations', async () => {
    await mount();
    expect(tree().getAttribute('aria-label')).toBe('Layers');
    expect(labels()).toEqual(['page', 'Hero', 'Box']);
    const [, hero] = items();
    expect(hero?.getAttribute('aria-level')).toBe('2');
    expect(hero?.getAttribute('aria-posinset')).toBe('1');
    expect(hero?.getAttribute('aria-setsize')).toBe('2');
    expect(hero?.getAttribute('aria-expanded')).toBe('false');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws an svg icon per row: the named one, or the neutral box, never a letter', async () => {
    await mount();
    const icons = items().map((item) => item.querySelector('.bd-layer-icon svg'));
    expect(icons.every((svg) => svg !== null)).toBe(true);
    expect(icons.map((svg) => svg?.getAttribute('data-icon'))).toEqual([
      'box',
      'layout-grid',
      'layout-grid',
    ]);
    expect(icons[0]?.getAttribute('data-fallback')).toBe('true');
    expect(icons[2]?.hasAttribute('data-fallback')).toBe(false);
    expect(items().every((item) => item.querySelector('.bd-layer-icon')?.textContent === '')).toBe(
      true,
    );
  });

  it('shows badges with accessible names', async () => {
    await mount();
    const [, , locked] = items();
    expect(locked?.querySelector('[role=img]')?.getAttribute('aria-label')).toBe('Locked');
  });

  it('is operable with the keyboard alone', async () => {
    const store = await mount();
    await act(async () => tree().focus());
    await press('ArrowDown');
    expect(store.getState().selectedIds).toEqual(['root']);
    await press('ArrowDown');
    expect(store.getState().selectedIds).toEqual(['boxNode001']);
    expect(tree().getAttribute('aria-activedescendant')).toBe(
      items().find((i) => i.dataset['nodeId'] === 'boxNode001')?.id,
    );

    await press('ArrowRight'); // expands
    expect(labels()).toEqual(['page', 'Hero', 'Text', 'Text', 'Box']);
    await press('ArrowRight'); // into the first child
    expect(store.getState().selectedIds).toEqual(['textNodeA1']);
    await press('ArrowLeft'); // out to the parent
    expect(store.getState().selectedIds).toEqual(['boxNode001']);
    await press('ArrowLeft'); // collapses
    expect(labels()).toEqual(['page', 'Hero', 'Box']);

    await press('End');
    expect(store.getState().selectedIds).toEqual(['boxNode002']);
    await press('Home');
    expect(store.getState().selectedIds).toEqual(['root']);
    await press('ArrowDown', { shiftKey: true });
    expect(store.getState().selectedIds).toEqual(['root', 'boxNode001']);
  });

  it('renames with F2, and Escape leaves the name alone', async () => {
    const store = await mount();
    await pick(store, 'boxNode002');
    await act(async () => tree().focus());
    await press('F2');
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Layer name');
    await act(async () => {
      input.value = 'Footer';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(store.getState().doc.nodes['boxNode002']?.name).toBe('Footer');
    expect(store.getState().undoLabel).toBe('node.setAttr');
    expect(container.querySelector('input')).toBeNull();

    await press('F2');
    await act(async () => {
      const again = container.querySelector('input') as HTMLInputElement;
      again.value = 'Nope';
      again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(store.getState().doc.nodes['boxNode002']?.name).toBe('Footer');
  });

  it('deletes the selection with Delete, and reports what the rules refuse', async () => {
    const store = await mount();
    await pick(store, 'root');
    await act(async () => tree().focus());
    await press('Delete'); // the root is never removed: nothing happens
    expect(store.getState().canUndo).toBe(false);

    await pick(store, 'boxNode001');
    await press('Delete');
    expect(store.getState().doc.nodes['boxNode001']).toBeUndefined();
    expect(labels()).toEqual(['page', 'Box']);
  });

  it('opens the ancestors of a node selected elsewhere, and marks it selected', async () => {
    const store = await mount();
    expect(labels()).toEqual(['page', 'Hero', 'Box']);
    await act(async () => store.select('textNodeB1'));
    expect(labels()).toEqual(['page', 'Hero', 'Text', 'Text', 'Box']);
    const selected = items().filter((i) => i.getAttribute('aria-selected') === 'true');
    expect(selected.map((i) => i.dataset['nodeId'])).toEqual(['textNodeB1']);
  });

  it('follows a click (with Ctrl adding), and hover goes both ways', async () => {
    const store = await mount();
    const row = (id: string) => items().find((i) => i.dataset['nodeId'] === id) as HTMLElement;
    await act(async () => row('boxNode001').click());
    expect(store.getState().selectedIds).toEqual(['boxNode001']);
    await act(async () => {
      row('boxNode002').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    });
    expect(store.getState().selectedIds).toEqual(['boxNode001', 'boxNode002']);

    await act(async () => {
      row('boxNode002').dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
    expect(store.getState().hoveredId).toBe('boxNode002');
    await act(async () => store.setHovered('boxNode001'));
    expect(row('boxNode001').dataset['hovered']).toBe('true');
    expect(row('boxNode002').dataset['hovered']).toBe('false');
  });

  it('toggles a row with its arrow, without selecting it', async () => {
    const store = await mount();
    const hero = items()[1] as HTMLElement;
    await act(async () => (hero.querySelector('[data-toggle]') as HTMLElement).click());
    expect(labels()).toEqual(['page', 'Hero', 'Text', 'Text', 'Box']);
    expect(store.getState().selectedIds).toEqual([]);
  });

  it('has a context menu: duplicate acts on the row the menu opened on', async () => {
    const store = await mount();
    const hero = items()[1] as HTMLElement;
    await act(async () => {
      hero.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }),
      );
    });
    expect(store.getState().selectedIds).toEqual(['boxNode001']);
    const menu = document.body.querySelector('[role=menu]');
    expect(menu?.getAttribute('aria-label')).toBe('Layer actions');
    const names = [...(menu?.querySelectorAll('[role=menuitem]') ?? [])].map((i) => i.textContent);
    expect(names).toEqual(['Rename', 'Duplicate', 'Wrap in container', 'Unwrap', 'Delete']);

    const duplicate = [...(menu?.querySelectorAll('[role=menuitem]') ?? [])].find(
      (i) => i.textContent === 'Duplicate',
    ) as HTMLElement;
    await act(async () => {
      duplicate.click();
    });
    expect(store.getState().doc.nodes['root']?.slots?.['default']).toHaveLength(3);
  });

  it('opens the same context menu from the hover "more" button, without starting a rename', async () => {
    const store = await mount();
    const more = items()[1]?.querySelector('[data-more] button') as HTMLElement;
    expect(more.getAttribute('aria-label')).toBe('More actions');
    await act(async () => {
      more.click();
    });
    expect(store.getState().selectedIds).toEqual(['boxNode001']);
    const menu = document.body.querySelector('[role=menu]');
    expect(menu?.getAttribute('aria-label')).toBe('Layer actions');
    expect(container.querySelector('input')).toBeNull();
  });

  it('does not offer changes in a read-only document', async () => {
    const store = await mount();
    await act(async () => store.setReadOnly(true));
    await pick(store, 'boxNode001');
    await act(async () => tree().focus());
    await press('Delete');
    await press('F2');
    expect(store.getState().doc.nodes['boxNode001']).toBeDefined();
    expect(container.querySelector('input')).toBeNull();
  });
});

describe('a large document', () => {
  const big = (): BuilderDocument => {
    const ids = Array.from({ length: 1000 }, (_, i) => `n${String(i).padStart(9, '0')}`);
    const nodes: Record<string, unknown> = {
      root: node('root', 'buildr/page', { slots: { default: ids } }),
    };
    for (const id of ids) nodes[id] = node(id, 'buildr/text', { props: { text: s(id) } });
    return { schemaVersion: 1, root: 'root', nodes, components: {} } as BuilderDocument;
  };

  it('flattens 1000 nodes in well under 50 ms', () => {
    const doc = big();
    const open = new Set(['root']);
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      expect(flattenTree(doc, open)).toHaveLength(1001);
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(50);
  });

  it('renders only the rows in view, and renders them quickly', async () => {
    const start = performance.now();
    await mount(big());
    const elapsed = performance.now() - start;
    expect(items().length).toBeLessThan(40);
    expect(elapsed).toBeLessThan(500);
    const list = container.querySelector('.bd-layers-list') as HTMLElement;
    expect(list.style.height).toBe(`${1001 * 28}px`);
  });

  it('scrolls the row of a far selection into view', async () => {
    const store = await mount(big());
    await act(async () => store.select('n000000900'));
    const present = items().map((i) => i.dataset['nodeId']);
    expect(present).toContain('n000000900');
  });
});
