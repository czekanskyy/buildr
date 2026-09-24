// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  type DataContext,
  type DataSchema,
  p,
  s,
  toManifest,
} from '@buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ManifestProvider } from '../../../app/manifest.tsx';
import { MessagesProvider } from '../../../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../../../store/index.ts';
import { Inspector } from '../inspector.tsx';
import {
  bindingOptions,
  checkBinding,
  checkFormula,
  defaultFormat,
  formatKindsFor,
  previewValue,
} from './analyze.ts';
import { InspectorDataProvider } from './data.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const widget: ComponentMeta = {
  type: 'buildr/widget',
  version: 1,
  label: 'Widget',
  category: 'content',
  props: {
    title: p.text({ label: 'Title', default: 'Hello' }),
    fixed: p.boolean({ default: true }),
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

const schema: DataSchema = {
  scopes: {
    post: {
      type: {
        t: 'object',
        fields: {
          title: { type: { t: 'string' }, label: 'Title' },
          views: { type: { t: 'number' } },
          published: { type: { t: 'date' } },
        },
      },
    },
  },
  entities: {},
};
const context: DataContext = {
  scopes: { post: { title: 'Hello world', views: 3, published: '2026-01-02T00:00:00Z' } },
  locale: 'en',
  locales: { default: 'en', fallback: true, intl: { en: 'en-US' } },
  timeZone: 'UTC',
  mode: 'preview',
};

const fixture = (props?: Record<string, unknown>): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['widget0001'] } },
    widget0001: {
      id: 'widget0001',
      type: 'buildr/widget',
      ...(props === undefined ? {} : { props: props as never }),
    },
  },
  components: {},
});

describe('analyze', () => {
  const accepts = ['string'] as const;

  it('lists the fields a prop can take', () => {
    expect(bindingOptions(schema, accepts).map((option) => option.path)).toEqual(['post.title']);
    expect(bindingOptions(undefined, accepts)).toEqual([]);
  });

  it('checks a binding against the schema', () => {
    expect(checkBinding(schema, 'post.title', accepts)).toBe('ok');
    expect(checkBinding(schema, 'post.nope', accepts)).toBe('missing');
    expect(checkBinding(schema, 'post.views', accepts)).toBe('type');
    expect(checkBinding(undefined, 'post.views', accepts)).toBe('unchecked');
  });

  it('checks a formula without running it', () => {
    expect(checkFormula('post.title', 'formula', schema, accepts).valid).toBe(true);
    expect(checkFormula('post.title +', 'formula', schema, accepts).valid).toBe(false);
    expect(checkFormula('   ', 'formula', schema, accepts).valid).toBe(false);
    expect(checkFormula('Hi {{ post.title }}', 'template', schema, accepts).valid).toBe(true);
  });

  it('previews a value against sample data and never throws', () => {
    expect(previewValue({ kind: 'binding', path: 'post.title' }, context).text).toBe('Hello world');
    expect(previewValue({ kind: 'expression', expr: 'post.views' }, context).text).toBe('3');
    expect(
      previewValue({ kind: 'expression', expr: 'post.views +' }, context).text,
    ).toBeUndefined();
    expect(previewValue({ kind: 'binding', path: 'post.title' }, undefined).text).toBeUndefined();
    expect(previewValue(s('x'), context).text).toBeUndefined();
  });

  it('offers formats that fit the field', () => {
    expect(formatKindsFor('date')).toEqual(['none', 'date']);
    expect(defaultFormat('none')).toBeUndefined();
    expect(defaultFormat('currency')).toEqual({ type: 'currency', currency: 'USD' });
  });
});

describe('value modes in the inspector', () => {
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

  async function mount(props?: Record<string, unknown>) {
    const store = createEditorStore({
      doc: fixture(props),
      registry,
      generateId: createSeededIdGenerator(3),
      validationDelayMs: null,
    });
    store.select('widget0001');
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <ManifestProvider manifest={manifest}>
            <EditorStoreProvider store={store}>
              <InspectorDataProvider schema={schema} context={context}>
                <Inspector />
              </InspectorDataProvider>
            </EditorStoreProvider>
          </ManifestProvider>
        </MessagesProvider>,
      ),
    );
    return store;
  }

  const title = () => container.querySelector('[data-prop=title]') as HTMLElement;
  const button = (name: string) =>
    [...title().querySelectorAll('button')].find(
      (element) => element.textContent === name,
    ) as HTMLButtonElement;
  const click = (element: Element) =>
    act(async () => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  const propOf = (store: Awaited<ReturnType<typeof mount>>) =>
    store.getState().doc.nodes['widget0001']?.props?.['title'];

  it('picking a field writes a binding', async () => {
    const store = await mount();
    await click(button('Data'));
    const field = [...title().querySelectorAll('button')].find((element) =>
      element.textContent?.includes('post.title'),
    ) as HTMLButtonElement;
    expect(field).toBeDefined();
    await click(field);
    expect(propOf(store)).toMatchObject({ kind: 'binding', path: 'post.title' });
    expect(title().textContent).toContain('Hello world');
  });

  it('does not save an invalid formula and says why', async () => {
    const store = await mount({ title: { kind: 'expression', expr: 'post.title' } });
    const area = title().querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(area, 'post.title +');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(propOf(store)).toEqual({ kind: 'expression', expr: 'post.title' });
    expect(title().querySelector('[role=alert]')).not.toBeNull();
  });

  it('marks a binding to a missing field as invalid', async () => {
    await mount({ title: { kind: 'binding', path: 'post.gone' } });
    expect(title().textContent).toContain('This field does not exist');
  });

  it('switching back to Fixed restores a static value', async () => {
    const store = await mount({ title: { kind: 'binding', path: 'post.title' } });
    await click(button('Fixed'));
    expect(propOf(store)?.kind ?? 'static').toBe('static');
  });
});
