// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  type PropDef,
  p,
  s,
  toManifest,
} from '@next-buildr/core';
import { $getRoot, type LexicalEditor } from 'lexical';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { ManifestProvider } from '../../app/manifest.tsx';
import { MessagesProvider } from '../../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../../store/index.ts';
import { parseNumber } from './controls/index.ts';
import { Inspector, type InspectorProps, InspectorRail } from './inspector.tsx';
import { isAdvancedProp, propLabel } from './props-panel.tsx';
import { readProp } from './value.ts';

expect.extend(matchers);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const widget: ComponentMeta = {
  type: 'buildr/widget',
  version: 1,
  label: 'Widget',
  category: 'content',
  props: {
    title: p.text({ label: 'Title', maxLength: 10, default: 'Hello', group: 'content' }),
    body: p.textarea({ default: '' }),
    count: p.number({ default: 5, min: 0, max: 10 }),
    visible: p.boolean({ default: true }),
    size: p.select({ options: ['sm', 'md', 'lg'], default: 'md' }),
    href: p.link({}),
    symbol: p.icon({}),
    ariaLabel: p.text({ group: 'accessibility' }),
    fixed: p.number({ default: 1, localizable: false }),
    rich: p.richText({ label: 'Rich text' }),
  },
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
    root: { id: 'root', type: 'buildr/page', slots: { default: ['widget0001', 'locked0001'] } },
    widget0001: { id: 'widget0001', type: 'buildr/widget' },
    locked0001: {
      id: 'locked0001',
      type: 'buildr/widget',
      lock: { content: true },
      props: { title: s('Locked') },
    },
  },
  components: {},
});

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

async function mount(
  select: string | null,
  extra: InspectorProps = {},
  doc = fixture(),
  customMeta?: ComponentMeta,
) {
  const currentRegistry = customMeta
    ? createRegistryMeta({ components: [page, customMeta] })
    : registry;
  const store = createEditorStore({
    doc,
    registry: currentRegistry,
    generateId: createSeededIdGenerator(3),
    validationDelayMs: null,
  });
  if (select !== null) store.select(select);
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <ManifestProvider manifest={customMeta ? toManifest(currentRegistry) : manifest}>
          <EditorStoreProvider store={store}>
            <Inspector {...extra} />
          </EditorStoreProvider>
        </ManifestProvider>
      </MessagesProvider>,
    ),
  );
  return store;
}

const field = (prop: string) => container.querySelector(`[data-prop=${prop}]`) as HTMLElement;
const input = (prop: string) =>
  field(prop).querySelector('input, textarea, button[role=combobox]') as HTMLInputElement;
const typeInto = (element: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
const propOf = (store: Awaited<ReturnType<typeof mount>>, id: string, prop: string) =>
  store.getState().doc.nodes[id]?.props?.[prop];
const openTab = (name: string) =>
  act(async () => {
    const tab = [...container.querySelectorAll('[role=tab]')].find((t) => t.textContent === name);
    tab?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
const notice = () => container.querySelector('[role=status]')?.textContent;

describe('helpers', () => {
  it('labels a prop by its label, else by its name in words', () => {
    expect(propLabel('title', widget.props['title'] as never)).toBe('Title');
    expect(propLabel('ariaLabel', widget.props['ariaLabel'] as never)).toBe('Aria label');
    expect(isAdvancedProp(widget.props['ariaLabel'] as never)).toBe(true);
    expect(isAdvancedProp(widget.props['title'] as never)).toBe(false);
  });

  it('parses only numbers a prop accepts', () => {
    const def = widget.props['count'] as never;
    expect(parseNumber('7', def)).toBe(7);
    expect(parseNumber('', def)).toBeUndefined();
    expect(parseNumber('abc', def)).toBeUndefined();
    expect(parseNumber('11', def)).toBeUndefined();
    expect(parseNumber('-1', def)).toBeUndefined();
  });

  it('reads static, translated, and bound values', () => {
    const def = widget.props['title'] as never;
    const node = {
      id: 'x',
      type: 'buildr/widget',
      props: { title: { kind: 'static' as const, value: 'Hi', l10n: { pl: 'Cześć' } } },
    };
    expect(readProp(node, 'title', def, 'en', 'en')).toMatchObject({ value: 'Hi', isSet: true });
    expect(readProp(node, 'title', def, 'pl', 'en')).toMatchObject({ value: 'Cześć', isSet: true });
    expect(readProp(node, 'title', def, 'de', 'en')).toMatchObject({ value: 'Hi', isSet: false });
    expect(readProp({ ...node, props: {} }, 'title', def, 'en', 'en')).toMatchObject({
      value: 'Hello',
      isSet: false,
    });
    const bound = { ...node, props: { title: { kind: 'binding' as const, path: 'post.title' } } };
    expect(readProp(bound, 'title', def, 'en', 'en')).toMatchObject({
      mode: 'binding',
      source: 'post.title',
    });
  });
});

describe('Inspector', () => {
  it('asks for a selection when there is none', async () => {
    await mount(null);
    expect(container.textContent).toContain('Select an element to edit it.');
  });

  it('collapses a prop group and remembers it per component type', async () => {
    window.localStorage.clear();
    await mount('widget0001');
    const toggle = () =>
      container.querySelector(
        '.bd-props-group[data-group=content] .bd-props-toggle',
      ) as HTMLElement;
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    await act(async () => toggle().click());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(window.localStorage.getItem('buildr.editor.inspector.groups.buildr/widget')).toBe(
      '["content"]',
    );
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount('widget0001');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    window.localStorage.clear();
  });

  const openMenu = async () => {
    const trigger = container.querySelector(
      'button[aria-label="More block options"]',
    ) as HTMLElement;
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
      trigger.click();
    });
  };
  const menuItem = (label: string) =>
    [...document.querySelectorAll('[role=menuitem]')].find(
      (el) => el.textContent === label,
    ) as HTMLElement;

  it('duplicates and deletes from the more menu with the same commands as the layers', async () => {
    const store = await mount('widget0001');
    await openMenu();
    await act(async () => menuItem('Duplicate').click());
    expect(Object.keys(store.getState().doc.nodes)).toHaveLength(4);
    await openMenu();
    await act(async () => menuItem('Delete block').click());
    expect(Object.keys(store.getState().doc.nodes)).toHaveLength(3);
    await act(async () => store.undo());
    expect(Object.keys(store.getState().doc.nodes)).toHaveLength(4);
  });

  it('navigates the more menu with the arrow keys', async () => {
    await mount('widget0001');
    await openMenu();
    const items = () => [...document.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const key = (k: string) =>
      act(async () => {
        (document.activeElement as HTMLElement).dispatchEvent(
          new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
        );
      });
    expect(items().length).toBeGreaterThanOrEqual(2);
    expect(document.activeElement).toBe(items()[0]);
    await key('ArrowDown');
    expect(document.activeElement).toBe(items()[1]);
    await key('End');
    expect(document.activeElement).toBe(items().at(-1));
    await key('ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    await key('ArrowUp');
    expect(document.activeElement).toBe(items().at(-1));
    await key('Home');
    expect(document.activeElement).toBe(items()[0]);
    await key('Escape');
    expect(document.querySelector('[role=menu]')).toBeNull();
    expect(document.activeElement).toBe(
      container.querySelector('button[aria-label="More block options"]'),
    );
  });

  it('does not report no match on the Advanced tab while its name field matches', async () => {
    await mount('widget0001');
    await openTab('Advanced');
    const search = container.querySelector('.bd-inspector-search input') as HTMLInputElement;
    await typeInto(search, 'name');
    expect(container.querySelector('[data-attr=name]')).not.toBeNull();
    expect(container.querySelector('[data-state=no-match]')).toBeNull();
    await typeInto(search, 'zzz');
    expect(container.querySelector('[data-attr=name]')).toBeNull();
    expect(container.querySelector('[data-state=no-match]')).not.toBeNull();
  });

  it('shows an excerpt of the text in the subtitle', async () => {
    await mount('widget0001');
    expect(container.querySelector('.bd-inspector-subtitle')?.textContent).toContain(
      'Widget · “Hello”',
    );
  });

  it('keeps its own tab, or follows a controlled one', async () => {
    await mount('widget0001');
    const tab = (name: string) =>
      [...container.querySelectorAll('[role=tab]')].find((el) =>
        el.textContent?.includes(name),
      ) as HTMLElement;
    await act(async () => {
      tab('Advanced').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    expect(tab('Advanced').getAttribute('aria-selected')).toBe('true');
    await act(async () => root.unmount());
    root = createRoot(container);
    const onTabChange = vi.fn();
    await mount('widget0001', { tab: 'style', onTabChange });
    expect(tab('Style').getAttribute('aria-selected')).toBe('true');
    await act(async () => {
      tab('Content').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    expect(onTabChange).toHaveBeenCalledWith('content');
    expect(tab('Style').getAttribute('aria-selected')).toBe('true');
  });

  it('shows the page settings action in the empty state only when given', async () => {
    await mount(null);
    expect(container.textContent).not.toContain('Page settings');
    await act(async () => root.unmount());
    root = createRoot(container);
    const onPageSettings = vi.fn();
    await mount(null, { onPageSettings });
    await act(async () =>
      (
        [...container.querySelectorAll('button')].find(
          (b) => b.textContent === 'Page settings',
        ) as HTMLElement
      ).click(),
    );
    expect(onPageSettings).toHaveBeenCalled();
  });

  it('renders the rail and reports tab and expand clicks', async () => {
    const onTabChange = vi.fn();
    const onExpand = vi.fn();
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <InspectorRail tab="content" onTabChange={onTabChange} onExpand={onExpand} />
        </MessagesProvider>,
      ),
    );
    const style = container.querySelector('button[aria-label="Style"]') as HTMLElement;
    await act(async () => style.click());
    expect(onTabChange).toHaveBeenCalledWith('style');
    expect(onExpand).toHaveBeenCalled();
  });

  it('gives every control an accessible name and passes axe', async () => {
    await mount('widget0001');
    expect(container.querySelector('h3')?.textContent).toBe('Widget');
    expect(input('title').getAttribute('aria-label')).toBe('Title');
    expect(container.querySelector('label[for]')?.textContent).toBeTruthy();
    // the hint is what the control is described by
    const described = input('title').getAttribute('aria-describedby');
    expect(container.querySelector(`[id="${described}"]`)?.textContent).toContain(
      'Maximum length: 10',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('writes text with node.setProp, and typing is one undo step', async () => {
    const store = await mount('widget0001');
    expect(input('title').value).toBe('Hello');
    await typeInto(input('title'), 'Hi');
    await typeInto(input('title'), 'Hi t');
    expect(propOf(store, 'widget0001', 'title')).toEqual({ kind: 'static', value: 'Hi t' });
    expect(store.getState().undoLabel).toBe('node.setProp');
    await act(async () => store.undo());
    expect(propOf(store, 'widget0001', 'title')).toBeUndefined();
    expect(store.getState().canUndo).toBe(false);
  });

  it('writes a textarea, a link and an icon', async () => {
    const store = await mount('widget0001');
    await typeInto(input('body'), 'Line');
    await typeInto(input('href'), '/about');
    await typeInto(input('symbol'), 'arrow-right');
    expect(propOf(store, 'widget0001', 'body')).toEqual({ kind: 'static', value: 'Line' });
    expect(propOf(store, 'widget0001', 'href')).toEqual({ kind: 'static', value: '/about' });
    expect(propOf(store, 'widget0001', 'symbol')).toEqual({ kind: 'static', value: 'arrow-right' });
  });

  it('writes a number only when it is valid, and shows the stored one again on blur', async () => {
    const store = await mount('widget0001');
    await typeInto(input('count'), '8');
    expect(propOf(store, 'widget0001', 'count')).toEqual({ kind: 'static', value: 8 });
    await typeInto(input('count'), '99');
    await typeInto(input('count'), '');
    expect(propOf(store, 'widget0001', 'count')).toEqual({ kind: 'static', value: 8 });
    await act(async () => {
      input('count').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(input('count').value).toBe('8');
  });

  it('toggles a boolean', async () => {
    const store = await mount('widget0001');
    expect(input('visible').checked).toBe(true);
    await act(async () => input('visible').click());
    expect(propOf(store, 'widget0001', 'visible')).toEqual({ kind: 'static', value: false });
  });

  it('chooses from a select', async () => {
    const store = await mount('widget0001');
    const trigger = input('size');
    expect(trigger.textContent).toContain('md');
    await act(async () => {
      trigger.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
      );
    });
    const option = [...document.querySelectorAll('[role=option]')].find(
      (o) => o.textContent === 'lg',
    );
    await act(async () => {
      option?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }));
      (option as HTMLElement | undefined)?.click();
    });
    expect(propOf(store, 'widget0001', 'size')).toEqual({ kind: 'static', value: 'lg' });
  });

  it('resets a value with node.unsetProp, and offers reset only when one is set', async () => {
    const store = await mount('widget0001');
    expect(field('title').querySelector('.bd-field-reset')).toBeNull();
    await typeInto(input('title'), 'Hi');
    const reset = field('title').querySelector('.bd-field-reset') as HTMLElement;
    expect(reset.getAttribute('aria-label')).toBe('Reset: Title');
    await act(async () => reset.click());
    expect(propOf(store, 'widget0001', 'title')).toBeUndefined();
    expect(input('title').value).toBe('Hello');
    expect(field('title').querySelector('.bd-field-reset')).toBeNull();
  });

  it('shows a bound prop in the data mode, with its path', async () => {
    const doc = fixture();
    const bound: BuilderDocument = {
      ...doc,
      nodes: {
        ...doc.nodes,
        widget0001: {
          id: 'widget0001',
          type: 'buildr/widget',
          props: {
            title: { kind: 'binding', path: 'post.title' },
            href: { kind: 'expression', expr: 'post.slug' },
          },
        },
      },
    };
    await mount('widget0001', {}, bound);
    expect((field('title').querySelector('input') as HTMLInputElement).value).toBe('post.title');
    await act(async () => {
      (field('title').querySelector('.bd-value-modes button') as HTMLButtonElement).click();
    });
    expect(
      document.querySelector('.bd-popover [aria-pressed=true]')?.getAttribute('aria-label'),
    ).toBe('Data');
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await act(async () => {
      (field('href').querySelector('.bd-value-modes button') as HTMLButtonElement).click();
    });
    expect(
      document.querySelector('.bd-popover [aria-pressed=true]')?.getAttribute('aria-label'),
    ).toBe('Formula');
    expect((field('href').querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'post.slug',
    );
  });

  it('writes a translation to the language being edited, only for translatable props', async () => {
    const store = await mount('widget0001', { locale: 'pl', defaultLocale: 'en' });
    await typeInto(input('title'), 'Cześć');
    expect(propOf(store, 'widget0001', 'title')).toEqual({
      kind: 'static',
      value: 'Hello',
      l10n: { pl: 'Cześć' },
    });
    await typeInto(input('fixed'), '4');
    expect(propOf(store, 'widget0001', 'fixed')).toEqual({ kind: 'static', value: 4 });
    // reset removes the translation, not the value
    await act(async () => (field('title').querySelector('.bd-field-reset') as HTMLElement).click());
    expect(propOf(store, 'widget0001', 'title')).toEqual({ kind: 'static', value: 'Hello' });
  });

  it('disables everything on locked content', async () => {
    const store = await mount('locked0001');
    expect(container.textContent).toContain('This content is locked.');
    expect(input('title').disabled).toBe(true);
    expect(input('visible').disabled).toBe(true);
    expect(store.getState().canUndo).toBe(false);
  });

  it('puts accessibility props, the name and the anchor on the Advanced tab', async () => {
    const store = await mount('widget0001');
    expect(field('ariaLabel')).toBeNull();
    await openTab('Advanced');
    await typeInto(input('ariaLabel'), 'Close');
    expect(propOf(store, 'widget0001', 'ariaLabel')).toEqual({ kind: 'static', value: 'Close' });

    const name = container.querySelector('[data-attr=name] input') as HTMLInputElement;
    await typeInto(name, 'Header');
    expect(store.getState().doc.nodes['widget0001']?.name).toBe('Header');
    await typeInto(name, '');
    expect(store.getState().doc.nodes['widget0001']?.name).toBeUndefined();

    const anchor = container.querySelector('[data-attr=anchor] input') as HTMLInputElement;
    await typeInto(anchor, 'Bad Anchor');
    expect(store.getState().doc.nodes['widget0001']?.anchor).toBeUndefined();
    expect(notice()).not.toBe('');
    expect(anchor.value).toBe('Bad Anchor');
    await typeInto(anchor, 'intro');
    expect(store.getState().doc.nodes['widget0001']?.anchor).toBe('intro');
    expect(notice()).toBe('');
  });

  it('removes a display condition', async () => {
    const doc = fixture();
    const conditional: BuilderDocument = {
      ...doc,
      nodes: {
        ...doc.nodes,
        widget0001: {
          id: 'widget0001',
          type: 'buildr/widget',
          visibleIf: { kind: 'binding', path: 'user.loggedIn' },
        },
      },
    };
    const store = await mount('widget0001', {}, conditional);
    await openTab('Advanced');
    const remove = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Remove the condition',
    );
    await act(async () => remove?.click());
    expect(store.getState().doc.nodes['widget0001']?.visibleIf).toBeUndefined();
  });

  it('leaves the Style tab to the style inspector', async () => {
    await mount('widget0001', { renderStyle: (node) => <p>styles of {node.id}</p> });
    await openTab('Style');
    expect(container.textContent).toContain('styles of widget0001');
  });
});

describe('template v2 prop controls', () => {
  it('scrubs bounded numeric props through node.setProp with undo and redo', async () => {
    const store = await mount('widget0001');
    const dispatch = vi.spyOn(store, 'dispatch');
    const label = field('count').querySelector('label') as HTMLElement;
    const drag = async (x: number) =>
      act(async () => {
        label.dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 0 }),
        );
        label.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: x }));
        label.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      });
    await drag(6);
    expect(propOf(store, 'widget0001', 'count')).toEqual({ kind: 'static', value: 7 });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'node.setProp',
      payload: { id: 'widget0001', prop: 'count', value: { kind: 'static', value: 7 } },
    });
    await drag(90);
    expect(propOf(store, 'widget0001', 'count')).toEqual({ kind: 'static', value: 10 });
    await act(async () => {
      store.undo();
    });
    expect(propOf(store, 'widget0001', 'count')).toEqual({ kind: 'static', value: 7 });
    await act(async () => {
      store.redo();
    });
    expect(propOf(store, 'widget0001', 'count')).toEqual({ kind: 'static', value: 10 });
  });

  it('saves underline, strike and clear as safe rich-text props, and undoes the changes', async () => {
    const doc = fixture();
    const node = doc.nodes['widget0001'];
    if (node === undefined) throw new Error('widget missing');
    const initial = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', version: 1, text: 'Hello', format: 0 }],
        },
      ],
    };
    const store = await mount(
      'widget0001',
      {},
      { ...doc, nodes: { ...doc.nodes, widget0001: { ...node, props: { rich: s(initial) } } } },
    );
    const dispatch = vi.spyOn(store, 'dispatch');
    const editor = (
      field('rich').querySelector('[role=textbox]') as HTMLElement & {
        __lexicalEditor: LexicalEditor;
      }
    ).__lexicalEditor;
    await act(async () => {
      editor.update(
        () => {
          $getRoot().select(0, 1);
        },
        { discrete: true },
      );
    });
    const format = async (label: string) =>
      act(async () => {
        field('rich').querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.click();
      });
    await format('Underline');
    const formatted = propOf(store, 'widget0001', 'rich');
    expect(formatted?.kind).toBe('static');
    expect(dispatch.mock.calls.every(([command]) => command.type === 'node.setProp')).toBe(true);
    expect(JSON.stringify(formatted)).toContain('"format":8');
    await act(async () => {
      store.undo();
    });
    expect(propOf(store, 'widget0001', 'rich')).toEqual(s(initial));
    await act(async () => {
      store.redo();
    });
    expect(JSON.stringify(propOf(store, 'widget0001', 'rich'))).toContain('"format":8');
    await act(async () => {
      editor.update(
        () => {
          $getRoot().select(0, 1);
        },
        { discrete: true },
      );
    });
    await format('Strikethrough');
    expect(JSON.stringify(propOf(store, 'widget0001', 'rich'))).toContain('"format":12');
    Range.prototype.getBoundingClientRect ??= () => new DOMRect();
    Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
    await act(async () =>
      editor.update(
        () => {
          $getRoot().getFirstDescendant()?.selectStart();
        },
        { discrete: true },
      ),
    );
    dispatch.mockClear();
    await format('Clear formatting');
    expect(dispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(propOf(store, 'widget0001', 'rich'))).toContain('"format":12');
    await act(async () =>
      editor.update(
        () => {
          $getRoot().select(0, 1);
        },
        { discrete: true },
      ),
    );
    await format('Clear formatting');
    expect(propOf(store, 'widget0001', 'rich')).toEqual(s(initial));
  });
});

describe('Advanced template controls', () => {
  it('places tabs before search and writes breakpoint visibility with undo and redo', async () => {
    const store = await mount('widget0001');
    const tabs = container.querySelector('[role=tablist]') as Element;
    const search = container.querySelector('.bd-inspector-search input') as Element;
    expect(tabs.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await openTab('Advanced');
    const chip = container.querySelector(
      '.bd-visibility-chips button:nth-child(2)',
    ) as HTMLButtonElement;
    await act(async () => chip.click());
    expect(
      store.getState().doc.nodes['widget0001']?.styles?.bp?.['tablet']?.visibility?.hidden,
    ).toBe(true);
    await act(async () => store.undo());
    expect(
      store.getState().doc.nodes['widget0001']?.styles?.bp?.['tablet']?.visibility?.hidden,
    ).toBeUndefined();
    await act(async () => store.redo());
    expect(
      store.getState().doc.nodes['widget0001']?.styles?.bp?.['tablet']?.visibility?.hidden,
    ).toBe(true);
    await act(async () => {
      for (const toggle of container.querySelectorAll<HTMLButtonElement>(
        '.bd-advanced-group > h4 button',
      ))
        toggle.click();
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Advanced condition commands', () => {
  it('clears a display condition with undo and redo', async () => {
    const base = fixture();
    const node = base.nodes['widget0001'];
    if (!node) throw new Error('missing fixture');
    const store = await mount(
      'widget0001',
      {},
      {
        ...base,
        nodes: {
          ...base.nodes,
          widget0001: { ...node, visibleIf: { kind: 'binding', path: 'post.published' } },
        },
      },
    );
    await openTab('Advanced');
    const remove = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Remove the condition',
    ) as HTMLButtonElement;
    await act(async () => remove.click());
    expect(store.getState().doc.nodes['widget0001']?.visibleIf).toBeUndefined();
    await act(async () => store.undo());
    expect(store.getState().doc.nodes['widget0001']?.visibleIf).toEqual({
      kind: 'binding',
      path: 'post.published',
    });
    await act(async () => store.redo());
    expect(store.getState().doc.nodes['widget0001']?.visibleIf).toBeUndefined();
  });
});

describe('Heading level segments', () => {
  it('shows six levels before text and writes the numeric prop through history', async () => {
    const store = await mount('widget0001', {}, fixture(), {
      ...widget,
      props: {
        title: widget.props['title'] as PropDef,
        level: p.select({ options: [1, 2, 3, 4, 5, 6], default: 2 }),
      },
    });
    const levels = field('level');
    const segments = levels.querySelectorAll('.bd-segment');
    expect([...segments].map((button) => button.textContent)).toEqual([
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
    ]);
    expect(
      levels.compareDocumentPosition(field('title')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await act(async () => (segments[2] as HTMLButtonElement).click());
    expect(propOf(store, 'widget0001', 'level')).toEqual(s(3));
    await act(async () => store.undo());
    expect(propOf(store, 'widget0001', 'level')).toBeUndefined();
    await act(async () => store.redo());
    expect(propOf(store, 'widget0001', 'level')).toEqual(s(3));
  });
});
