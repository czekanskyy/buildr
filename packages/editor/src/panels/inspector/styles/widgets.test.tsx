// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  defaultTheme,
  type StyleGroup,
  toManifest,
} from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManifestProvider } from '../../../app/manifest.tsx';
import { MessagesProvider } from '../../../messages/index.tsx';
import { createEditorStore, EditorStoreProvider, useEditorState } from '../../../store/index.ts';
import { StyleInspector } from './style-inspector.tsx';
import { ShadowLayers } from './widgets.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const box: ComponentMeta = {
  type: 'buildr/box',
  version: 1,
  label: 'Box',
  category: 'layout',
  props: {},
  contentCategories: ['flow'],
  styles: { groups: ['layout', 'spacing', 'effects', 'background', 'border'] },
  runtime: 'shared',
  slots: { default: {} },
};
const page: ComponentMeta = {
  ...box,
  type: 'buildr/page',
  label: 'Page',
  capabilities: { root: true },
};

const fixture = (base: object = {}): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['box0000001'] } },
    box0000001: { id: 'box0000001', type: 'buildr/box', styles: { base } },
  },
  components: {},
});

let container: HTMLElement;
let root: Root;
beforeEach(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

type Store = ReturnType<typeof createEditorStore>;

async function mount(base: object, groups: readonly StyleGroup[]): Promise<Store> {
  const reg = createRegistryMeta({ components: [page, { ...box, styles: { groups } }] });
  const store = createEditorStore({
    doc: fixture(base),
    registry: reg,
    readOnly: false,
    generateId: createSeededIdGenerator(3),
    validationDelayMs: null,
  });
  store.select('box0000001');
  const View = () => {
    const node = useEditorState((state) =>
      state.anchorId === null ? undefined : state.doc.nodes[state.anchorId],
    );
    return node === undefined ? null : <StyleInspector node={node} />;
  };
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <ManifestProvider manifest={toManifest(reg)}>
          <EditorStoreProvider store={store}>
            <View />
          </EditorStoreProvider>
        </ManifestProvider>
      </MessagesProvider>,
    ),
  );
  return store;
}
const base = (store: Store) => store.getState().doc.nodes['box0000001']?.styles?.base;
const type = (element: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
const byLabel = (name: string) =>
  container.querySelector(`[aria-label="${name}"]`) as HTMLInputElement;
const buttonNamed = (name: string) =>
  [...container.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === name,
  ) as HTMLButtonElement;
const clickAdd = () =>
  act(async () => container.querySelector<HTMLButtonElement>('.bd-wshadow__add')?.click());

describe('box model', () => {
  it('draws margin around padding with a bar each, and writes only through setStyle', async () => {
    const store = await mount({ spacing: { padding: { top: '4px' } } }, ['spacing']);
    expect(container.querySelector('.bd-boxmodel .bd-wbox .bd-wbox--in')).not.toBeNull();
    expect(container.querySelectorAll('.bd-boxbar .bd-style-head')).toHaveLength(2);
    const dispatch = vi.spyOn(store, 'dispatch');
    await type(byLabel('Padding top'), '12');
    expect(base(store)?.spacing?.padding).toEqual({ top: '12px' });
    for (const [command] of dispatch.mock.calls) expect(command.type).toBe('node.setStyle');
  });

  it('the link toggle makes one value write every side, with setStyle commands only', async () => {
    const store = await mount({ spacing: { padding: { top: '4px' } } }, ['spacing']);
    const dispatch = vi.spyOn(store, 'dispatch');
    await act(async () => buttonNamed('Padding: Link sides').click());
    await type(byLabel('Padding left'), '8');
    expect(base(store)?.spacing?.padding).toEqual({
      top: '8px',
      right: '8px',
      bottom: '8px',
      left: '8px',
    });
    for (const [command] of dispatch.mock.calls) expect(command.type).toBe('node.setStyle');
  });
});

describe('alignment pad', () => {
  it('names the chosen cell in a caption and selects with aria-checked', async () => {
    const store = await mount({ background: { imagePosition: 'top left' } }, ['background']);
    const pad = container.querySelector('.bd-alignment-pad') as HTMLElement;
    expect(pad.getAttribute('role')).toBe('radiogroup');
    expect(pad.querySelector('[aria-label="top left"]')?.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('.bd-wpad__caption strong')?.textContent).toBe('Top left');
    await act(async () => pad.querySelector<HTMLButtonElement>('[aria-label="bottom"]')?.click());
    expect(base(store)?.background?.imagePosition).toBe('bottom');
    expect(container.querySelector('.bd-wpad__caption strong')?.textContent).toBe('Bottom');
  });
});

const key = (element: Element, name: string) =>
  act(async () => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
    );
  });

describe('radio keyboard navigation', () => {
  it('moves focus and selection over the 3x3 pad with a roving tab stop', async () => {
    const store = await mount({ background: { imagePosition: 'top left' } }, ['background']);
    const radios = () => [
      ...container.querySelectorAll<HTMLButtonElement>('.bd-alignment-pad [role="radio"]'),
    ];
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1, -1, -1]);
    await key(radios()[0] as Element, 'ArrowRight');
    expect(base(store)?.background?.imagePosition).toBe('top');
    expect(document.activeElement).toBe(radios()[1]);
    expect(radios()[1]?.tabIndex).toBe(0);
    await key(radios()[1] as Element, 'ArrowDown');
    expect(base(store)?.background?.imagePosition).toBe('center');
    await key(radios()[4] as Element, 'ArrowLeft');
    await key(radios()[3] as Element, 'ArrowLeft');
    expect(base(store)?.background?.imagePosition).toBe('right');
    await key(radios()[5] as Element, 'ArrowUp');
    await key(radios()[2] as Element, 'ArrowUp');
    expect(base(store)?.background?.imagePosition).toBe('bottom right');
    await key(radios()[8] as Element, 'Home');
    expect(base(store)?.background?.imagePosition).toBe('top left');
    await key(radios()[0] as Element, 'End');
    expect(base(store)?.background?.imagePosition).toBe('bottom right');
  });

  it('moves over the shadow presets with wrapping', async () => {
    const store = await mount({ effects: { shadow: 'none' } }, ['effects']);
    const radios = () => [
      ...container.querySelectorAll<HTMLButtonElement>('.bd-shadow-presets [role="radio"]'),
    ];
    const last = radios().length - 1;
    expect(radios().filter((r) => r.tabIndex === 0)).toHaveLength(1);
    expect(radios()[0]?.tabIndex).toBe(0);
    await key(radios()[0] as Element, 'ArrowLeft');
    expect(radios()[last]?.getAttribute('aria-checked')).toBe('true');
    expect(base(store)?.effects?.shadow).toMatch(/^\$shadow\./);
    await key(radios()[last] as Element, 'ArrowRight');
    expect(radios()[0]?.getAttribute('aria-checked')).toBe('true');
  });
});

describe('range slider', () => {
  it('shows the value in a bubble and writes it as a number', async () => {
    const store = await mount({ effects: { opacity: 0.5 } }, ['effects']);
    const range = container.querySelector(
      '[data-path="effects.opacity"] .bd-slider input[type="range"]',
    ) as HTMLInputElement;
    expect(container.querySelector('.bd-slider__bubble')?.textContent).toBe('0.5');
    await type(range, '0.8');
    expect(base(store)?.effects?.opacity).toBe(0.8);
    expect(container.querySelector('.bd-slider__bubble')?.textContent).toBe('0.8');
  });
});

describe('colour field', () => {
  const colorInput = () =>
    container.querySelector('[data-path="background.color"] input') as HTMLInputElement;

  it('ignores an invalid hex and writes a valid one', async () => {
    const store = await mount({}, ['background']);
    await type(colorInput(), '#zzz');
    expect(base(store)?.background?.color).toBeUndefined();
    expect(colorInput().getAttribute('aria-invalid')).toBe('true');
    await type(colorInput(), '#123456');
    expect(base(store)?.background?.color).toBe('#123456');
  });

  it('writes the token chosen in the token picker', async () => {
    const store = await mount({}, ['background']);
    const name = Object.keys(defaultTheme.tokens.color)[0] as string;
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-path="background.color"] .bd-token-trigger',
    );
    await act(async () => trigger?.click());
    const entry = [...document.querySelectorAll<HTMLButtonElement>('.bd-token')].find(
      (button) => button.textContent === name,
    );
    await act(async () => entry?.click());
    expect(base(store)?.background?.color).toBe(`$color.${name}`);
  });
});

describe('shadow cards', () => {
  it('shows one read-only card per layer of the chosen token and cannot add a layer', async () => {
    const name = Object.keys(defaultTheme.tokens.shadow)[0] as string;
    const store = await mount({ effects: { shadow: `$shadow.${name}` } }, ['effects']);
    const layers = String(defaultTheme.tokens.shadow[name]).split('),').length;
    expect(container.querySelectorAll('.bd-wshadow__card').length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll('.bd-wshadow__card').length).toBeLessThanOrEqual(layers + 4);
    expect(container.querySelector('.bd-wshadow__add')).toBeNull();
    expect(byLabel('Shadow 1: Blur').disabled).toBe(true);
    expect(base(store)?.effects?.shadow).toBe(`$shadow.${name}`);
  });

  it('adds, edits and removes layers through onChange, as the grammar allows four', async () => {
    const onChange = vi.fn();
    const View = ({ value }: { value: string }) => (
      <MessagesProvider locale="en">
        <ShadowLayers theme={defaultTheme} value={value} disabled={false} onChange={onChange} />
      </MessagesProvider>
    );
    await act(async () => root.render(<View value="none" />));
    expect(container.querySelectorAll('.bd-wshadow__card')).toHaveLength(0);
    await clickAdd();
    expect(onChange).toHaveBeenLastCalledWith('0px 4px 12px 0px #00000026');
    const two = '0px 4px 12px 0px #00000026, 0px 2px 4px 0px #00000026';
    await act(async () => root.render(<View value={two} />));
    expect(container.querySelectorAll('.bd-wshadow__card')).toHaveLength(2);
    await type(byLabel('Shadow 1: Blur'), '20');
    expect(onChange).toHaveBeenLastCalledWith(
      '0px 4px 20px 0px #00000026, 0px 2px 4px 0px #00000026',
    );
    await type(byLabel('Shadow 1: Shadow colour'), '#12');
    expect(onChange).toHaveBeenCalledTimes(2);
    await act(async () => buttonNamed('Remove: Shadow 2').click());
    expect(onChange).toHaveBeenLastCalledWith('0px 4px 12px 0px #00000026');
    await act(async () => root.render(<View value="0px 4px 12px 0px #00000026" />));
    await act(async () => buttonNamed('Remove: Shadow 1').click());
    expect(onChange).toHaveBeenLastCalledWith('none');
  });
});

describe('reset field', () => {
  it('shows the icon only for an override and removes that value', async () => {
    const store = await mount({ background: { color: '#123456' } }, ['background']);
    const field = '[data-style-prop="background.color"]';
    expect(container.querySelector(`${field} .bd-reset-slot`)).toBeNull();
    const dispatch = vi.spyOn(store, 'dispatch');
    await act(async () => buttonNamed('Restore default: Color').click());
    expect(base(store)?.background?.color).toBeUndefined();
    expect(dispatch.mock.calls.map(([command]) => command.type)).toEqual(['node.unsetStyle']);
    expect(container.querySelector(`${field} .bd-reset-slot`)).not.toBeNull();
    expect(container.querySelector(`${field} .bd-reset`)).toBeNull();
  });
});
