// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  defaultTheme,
  getStyleProperty,
  toManifest,
} from '@buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ManifestProvider } from '../../../app/manifest.tsx';
import { MessagesProvider } from '../../../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../../../store/index.ts';
import { checkStyleInput } from './model.ts';
import { StyleInspector } from './style-inspector.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const box: ComponentMeta = {
  type: 'buildr/box',
  version: 1,
  label: 'Box',
  category: 'layout',
  props: {},
  contentCategories: ['flow'],
  styles: { groups: ['layout', 'spacing', 'visibility'] },
  runtime: 'shared',
  slots: { default: {} },
};
const page: ComponentMeta = {
  ...box,
  type: 'buildr/page',
  label: 'Page',
  capabilities: { root: true },
};
const registry = createRegistryMeta({ components: [page, box] });
const manifest = toManifest(registry);

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['box0000001'] } },
    box0000001: {
      id: 'box0000001',
      type: 'buildr/box',
      styles: {
        base: { layout: { gap: '$space.4' } },
        bp: { tablet: { layout: { display: 'grid' } } },
      },
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
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

type Store = ReturnType<typeof createEditorStore>;

async function mount(breakpoint?: string): Promise<Store> {
  const store = createEditorStore({
    doc: fixture(),
    registry,
    generateId: createSeededIdGenerator(3),
    validationDelayMs: null,
  });
  store.select('box0000001');
  const View = () => {
    const node = store.getState().doc.nodes['box0000001'];
    if (node === undefined) return null;
    return <StyleInspector node={node} {...(breakpoint !== undefined ? { breakpoint } : {})} />;
  };
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <ManifestProvider manifest={manifest}>
          <EditorStoreProvider store={store}>
            <View />
          </EditorStoreProvider>
        </ManifestProvider>
      </MessagesProvider>,
    ),
  );
  return store;
}
const styles = (store: Store) => store.getState().doc.nodes['box0000001']?.styles;
const inputAt = (path: string) =>
  container.querySelector(`[data-path="${path}"] input`) as HTMLInputElement;
const type = (element: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });

describe('checkStyleInput', () => {
  const gap = getStyleProperty('layout', 'gap');
  const opacity = getStyleProperty('effects', 'opacity');
  it('accepts tokens the theme has and lengths', () => {
    if (gap === undefined) throw new Error('no gap');
    expect(checkStyleInput(gap, '$space.4', defaultTheme)).toEqual({ ok: true, value: '$space.4' });
    expect(checkStyleInput(gap, '12px', defaultTheme)).toEqual({ ok: true, value: '12px' });
  });
  it('rejects a token the theme lacks and values outside the grammar', () => {
    if (gap === undefined) throw new Error('no gap');
    expect(checkStyleInput(gap, '$space.99', defaultTheme).ok).toBe(false);
    for (const bad of ['url(x)', 'calc(1px + 2px)', '1px; color: red', '12qq']) {
      expect(checkStyleInput(gap, bad, defaultTheme).ok).toBe(false);
    }
  });
  it('turns numeric text into a number where the grammar takes one', () => {
    if (opacity === undefined) throw new Error('no opacity');
    expect(checkStyleInput(opacity, '0.5', defaultTheme)).toEqual({ ok: true, value: 0.5 });
    expect(checkStyleInput(opacity, '3', defaultTheme).ok).toBe(false);
  });
});

describe('StyleInspector', () => {
  it('shows only the groups the component allows', async () => {
    await mount();
    const groups = [...container.querySelectorAll('[data-group]')].map((g) =>
      g.getAttribute('data-group'),
    );
    expect(groups).toEqual(['layout', 'spacing', 'visibility']);
  });

  it('writes to desktop with no breakpoint', async () => {
    const store = await mount();
    await type(inputAt('layout.gap'), '2rem');
    expect(styles(store)?.base?.layout?.gap).toBe('2rem');
  });

  it('writes to the breakpoint being edited', async () => {
    const store = await mount('mobile');
    await type(inputAt('layout.gap'), '8px');
    expect(styles(store)?.bp?.['mobile']?.layout?.gap).toBe('8px');
    expect(styles(store)?.base?.layout?.gap).toBe('$space.4');
  });

  it('shows a value from a wider breakpoint as inherited', async () => {
    await mount('mobile');
    const field = container.querySelector('[data-path="layout.gap"]') as HTMLElement;
    expect(field.textContent).toContain('from desktop');
    const select = container.querySelector(
      '[data-style-prop="layout.display"] select',
    ) as HTMLSelectElement;
    expect(select.options[0]?.text).toContain('grid (tablet)');
  });

  it('does not save a value outside the grammar and says why', async () => {
    const store = await mount();
    await type(inputAt('layout.gap'), 'url(x)');
    expect(styles(store)?.base?.layout?.gap).toBe('$space.4');
    expect(container.querySelector('[role=alert]')).not.toBeNull();
    expect(inputAt('layout.gap').getAttribute('aria-invalid')).toBe('true');
  });

  it('resets only the layer being edited', async () => {
    const store = await mount('tablet');
    const reset = container.querySelector(
      '[data-style-prop="layout.display"] button',
    ) as HTMLButtonElement;
    await act(async () => reset.click());
    expect(styles(store)?.bp?.['tablet']?.layout?.display).toBeUndefined();
    expect(styles(store)?.base?.layout?.gap).toBe('$space.4');
  });

  it('edits one side of a box property', async () => {
    const store = await mount();
    await type(inputAt('spacing.margin.top'), '$space.2');
    expect(styles(store)?.base?.spacing?.margin?.top).toBe('$space.2');
  });

  it('toggles hiding per breakpoint', async () => {
    const store = await mount('mobile');
    const check = container.querySelector(
      '[data-style-prop="visibility.hidden"] input',
    ) as HTMLInputElement;
    await act(async () => check.click());
    expect(styles(store)?.bp?.['mobile']?.visibility?.hidden).toBe(true);
  });

  it('refuses an unknown breakpoint', async () => {
    await mount('watch');
    expect(container.textContent).toContain('not in the theme');
    expect(inputAt('layout.gap').disabled).toBe(true);
  });
});
