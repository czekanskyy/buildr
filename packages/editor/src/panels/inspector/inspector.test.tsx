// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
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
import { parseNumber } from './controls/index.ts';
import { Inspector, type InspectorProps } from './inspector.tsx';
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

async function mount(select: string | null, extra: InspectorProps = {}, doc = fixture()) {
  const store = createEditorStore({
    doc,
    registry,
    generateId: createSeededIdGenerator(3),
    validationDelayMs: null,
  });
  if (select !== null) store.select(select);
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <ManifestProvider manifest={manifest}>
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

  it('duplicates and deletes from the header with the same commands as the layers', async () => {
    const store = await mount('widget0001');
    const named = (label: string) =>
      container.querySelector(`button[aria-label="${label}"]`) as HTMLElement;
    await act(async () => named('Duplicate element').click());
    expect(Object.keys(store.getState().doc.nodes)).toHaveLength(4);
    await act(async () => named('Delete element').click());
    expect(Object.keys(store.getState().doc.nodes)).toHaveLength(3);
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
    expect(field('title').querySelector('[aria-pressed=true]')?.textContent).toBe('Data');
    expect(field('href').querySelector('[aria-pressed=true]')?.textContent).toBe('Formula');
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
