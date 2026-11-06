// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  p,
  toManifest,
} from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ManifestProvider } from '../../app/manifest.tsx';
import { MessagesProvider } from '../../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../../store/index.ts';
import { cssProblems, describeCssProblem } from './author-fields.tsx';
import { Inspector } from './inspector.tsx';
import { hasTextModes } from './props-panel.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const text: ComponentMeta = {
  type: 'buildr/text',
  version: 1,
  label: 'Text',
  category: 'content',
  props: {
    mode: p.select({ options: ['plain', 'rich', 'html'], default: 'plain', group: 'content' }),
    text: p.textarea({ default: 'Hello', group: 'content' }),
    rich: p.richText({ label: 'Rich text', group: 'content' }),
    html: p.textarea({ format: 'html', default: '', group: 'content' }),
  },
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
  slots: { default: {} },
};
const page: ComponentMeta = {
  ...text,
  type: 'buildr/page',
  label: 'Page',
  props: {},
  capabilities: { root: true },
};
const registry = createRegistryMeta({ components: [page, text] });
const manifest = toManifest(registry);

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['text00001'] } },
    text00001: { id: 'text00001', type: 'buildr/text' },
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

async function mount(authorCode: boolean | undefined, tab = 'Advanced') {
  const store = createEditorStore({
    doc: fixture(),
    registry,
    generateId: createSeededIdGenerator(3),
    validationDelayMs: null,
    ...(authorCode === undefined ? {} : { capabilities: { authorCode } }),
  });
  store.select('text00001');
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <ManifestProvider manifest={manifest}>
          <EditorStoreProvider store={store}>
            <Inspector />
          </EditorStoreProvider>
        </ManifestProvider>
      </MessagesProvider>,
    ),
  );
  await act(async () => {
    const el = [...container.querySelectorAll('[role=tab]')].find((t) => t.textContent === tab);
    el?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
  return store;
}

const typeInto = (element: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
const blur = (element: HTMLElement) =>
  act(async () => {
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
const attr = (name: string) => container.querySelector(`[data-attr=${name}]`) as HTMLElement;
const node = (store: Awaited<ReturnType<typeof mount>>) => store.getState().doc.nodes['text00001'];

describe('capability plumbing', () => {
  it('is off unless the host passes exactly true', async () => {
    expect((await mount(undefined)).authorCode).toBe(false);
    expect((await mount(false)).authorCode).toBe(false);
    expect((await mount(true)).authorCode).toBe(true);
  });

  it('refuses author attributes through the command while off', async () => {
    const store = await mount(false);
    const result = store.dispatch({
      type: 'node.setAttr',
      payload: { id: 'text00001', key: 'classes', value: ['hero'] } as never,
    });
    expect(result.ok).toBe(false);
    expect(node(store)?.classes).toBeUndefined();
  });
});

describe('Advanced author fields', () => {
  it('shows a quiet note and no fields while author code is off', async () => {
    await mount(false);
    expect(container.querySelector('[data-state=author-off]')).not.toBeNull();
    expect(attr('customCss')).toBeNull();
    expect(attr('classes')).toBeNull();
    expect(attr('attributes')).toBeNull();
  });

  it('shows the three fields while it is on', async () => {
    await mount(true);
    expect(container.querySelector('[data-state=author-off]')).toBeNull();
    expect(attr('customCss')).not.toBeNull();
    expect(attr('classes')).not.toBeNull();
    expect(attr('attributes')).not.toBeNull();
  });

  it('applies valid CSS on blur and keeps a refused one out of the document', async () => {
    const store = await mount(true);
    const area = attr('customCss').querySelector('textarea') as HTMLTextAreaElement;
    await typeInto(area, '& { color: red; }');
    await blur(area);
    expect(node(store)?.customCss).toBe('& { color: red; }');

    await typeInto(area, '@import url("https://x.test/a.css");');
    await blur(area);
    expect(attr('customCss').querySelector('[role=alert]')).not.toBeNull();
    expect(node(store)?.customCss).toBe('& { color: red; }');
  });

  it('writes classes and rejects an unsafe one', async () => {
    const store = await mount(true);
    const field = attr('classes').querySelector('input') as HTMLInputElement;
    await typeInto(field, 'hero wide');
    await blur(field);
    expect(node(store)?.classes).toEqual(['hero', 'wide']);

    await typeInto(field, 'bad"class');
    await blur(field);
    expect(attr('classes').querySelector('[role=alert]')).not.toBeNull();
    expect(node(store)?.classes).toEqual(['hero', 'wide']);
  });

  it('shows the stored CSS again after an undo, dropping an unapplied draft', async () => {
    const store = await mount(true);
    const area = attr('customCss').querySelector('textarea') as HTMLTextAreaElement;
    await typeInto(area, '& { color: red; }');
    await blur(area);
    await typeInto(area, '& { color: blue; }');
    expect(area.value).toBe('& { color: blue; }');
    await act(async () => void store.undo());
    expect(node(store)?.customCss).toBeUndefined();
    expect(area.value).toBe('');
  });

  it('shows the stored classes again after an undo, dropping an unapplied draft', async () => {
    const store = await mount(true);
    const field = attr('classes').querySelector('input') as HTMLInputElement;
    await typeInto(field, 'hero');
    await blur(field);
    await typeInto(field, 'hero extra');
    await act(async () => void store.undo());
    expect(field.value).toBe('');
  });

  it('states the class limit through the localized hint', async () => {
    await mount(true);
    expect(attr('classes').textContent).toMatch(/\(\d+ max\)/);
    expect(attr('classes').textContent).not.toContain('{max}');
  });

  it('writes an attribute row once its name is set', async () => {
    const store = await mount(true);
    const add = [...attr('attributes').querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Add'),
    );
    await act(async () => add?.click());
    const [name, value] = [...attr('attributes').querySelectorAll('input')] as HTMLInputElement[];
    await typeInto(name as HTMLInputElement, 'data-id');
    await typeInto(value as HTMLInputElement, '7');
    await blur(value as HTMLInputElement);
    expect(node(store)?.attributes).toEqual({ 'data-id': '7' });
  });
});

describe('css problems', () => {
  it('is empty for valid or empty CSS', () => {
    expect(cssProblems('')).toEqual([]);
    expect(cssProblems('& { color: red; }')).toEqual([]);
  });

  it('adds a line number when the message quotes the source', () => {
    expect(describeCssProblem('a\nfoo', 'bad "foo" here', 'line {line}')).toBe(
      'bad "foo" here (line 2)',
    );
    expect(describeCssProblem('a', 'no quote', 'line {line}')).toBe('no quote');
  });
});

describe('Text modes', () => {
  it('is recognised by the prop shape', () => {
    expect(hasTextModes(text.props)).toBe(true);
    expect(hasTextModes({ ...text.props, rich: p.text({}) })).toBe(false);
  });

  it('shows only the field of the chosen mode', async () => {
    const store = await mount(true, 'Content');
    const has = (name: string) => container.querySelector(`[data-prop=${name}]`) !== null;
    expect(has('text')).toBe(true);
    expect(has('rich')).toBe(false);
    expect(has('html')).toBe(false);
    await act(async () => {
      store.dispatch({
        type: 'node.setProp',
        payload: {
          id: 'text00001',
          prop: 'mode',
          value: { kind: 'static', value: 'html' },
        } as never,
      });
    });
    expect(has('text')).toBe(false);
    expect(has('html')).toBe(true);
  });

  it('disables the HTML mode and its field while author code is off', async () => {
    await mount(false, 'Content');
    const html = [...container.querySelectorAll('.bd-segment')].find(
      (b) => b.textContent === 'HTML code',
    ) as HTMLButtonElement;
    expect(html.disabled).toBe(true);
  });

  it('reports what the sanitiser removes', async () => {
    const store = await mount(true, 'Content');
    await act(async () => {
      store.dispatch({
        type: 'node.setProp',
        payload: {
          id: 'text00001',
          prop: 'mode',
          value: { kind: 'static', value: 'html' },
        } as never,
      });
    });
    const area = container.querySelector('[data-prop=html] textarea') as HTMLTextAreaElement;
    await typeInto(area, '<p>ok</p><script>alert(1)</script>');
    expect(container.querySelector('.bd-author-problems[data-kind=removed]')).not.toBeNull();
    expect(container.querySelector('.bd-code-preview')?.textContent).toContain('<p>ok</p>');
    expect(container.querySelector('.bd-code-preview')?.textContent).not.toContain('script');
  });
});
