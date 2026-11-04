// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  defaultTheme,
  getStyleProperty,
  type StyleGroup,
  toManifest,
} from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { ManifestProvider } from '../../../app/manifest.tsx';
import { MessagesProvider } from '../../../messages/index.tsx';
import { createEditorStore, EditorStoreProvider, useEditorState } from '../../../store/index.ts';
import { boundsOf, checkStyleInput } from './model.ts';
import { StyleSectionsProvider } from './sections-context.tsx';
import { SectionsToggle } from './sections-toggle.tsx';
import { StyleInspector } from './style-inspector.tsx';

expect.extend(matchers);
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
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  localStorage.clear();
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

type Store = ReturnType<typeof createEditorStore>;

async function mount(
  breakpoint?: string,
  groups?: readonly StyleGroup[],
  readOnly = false,
): Promise<Store> {
  const activeRegistry =
    groups === undefined
      ? registry
      : createRegistryMeta({ components: [page, { ...box, styles: { groups } }] });
  const activeManifest = groups === undefined ? manifest : toManifest(activeRegistry);
  const store = createEditorStore({
    doc: fixture(),
    registry: activeRegistry,
    readOnly,
    generateId: createSeededIdGenerator(3),
    validationDelayMs: null,
  });
  store.select('box0000001');
  const View = () => {
    const node = useEditorState((state) =>
      state.anchorId === null ? undefined : state.doc.nodes[state.anchorId],
    );
    if (node === undefined) return null;
    return (
      <StyleSectionsProvider>
        <SectionsToggle />
        <StyleInspector node={node} {...(breakpoint !== undefined ? { breakpoint } : {})} />
      </StyleSectionsProvider>
    );
  };
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <ManifestProvider manifest={activeManifest}>
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
  it('uses the grammar bounds for each scrubbed notation', () => {
    const lineHeight = getStyleProperty('typography', 'lineHeight');
    const columns = getStyleProperty('layout', 'columns');
    if (lineHeight === undefined || columns === undefined) throw new Error('property missing');
    expect(boundsOf(lineHeight, '1')).toEqual({ min: 0.5, max: 5 });
    expect(boundsOf(lineHeight, '24px')).toEqual({ min: 0 });
    expect(boundsOf(columns, '2')).toEqual({ min: 1, max: 12 });
  });
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
    const pressed = container.querySelector(
      '[data-style-prop="layout.display"] [aria-pressed=true]',
    );
    expect(pressed?.textContent).toBe('grid');
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

const press = (element: HTMLElement, key: string, init: KeyboardEventInit = {}) =>
  act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
const buttonNamed = (name: string) =>
  [...container.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === name || b.textContent === name,
  ) as HTMLButtonElement;

describe('style inspector controls (PB-128)', () => {
  it('steps a number with the arrow keys, Shift takes ten, and one undo undoes the run', async () => {
    const store = await mount();
    const input = inputAt('layout.gap');
    await type(input, '10px');
    await press(input, 'ArrowUp');
    expect(styles(store)?.base?.layout?.gap).toBe('11px');
    await press(input, 'ArrowUp', { shiftKey: true });
    expect(styles(store)?.base?.layout?.gap).toBe('21px');
    await press(input, 'ArrowDown');
    expect(styles(store)?.base?.layout?.gap).toBe('20px');
    await act(async () => {
      store.undo();
    });
    expect(styles(store)?.base?.layout?.gap).toBe('$space.4');
  });

  it('offers only the units of the grammar and keeps the number when the unit changes', async () => {
    await mount();
    await type(inputAt('layout.gap'), '10px');
    const menu = container.querySelector(
      '[data-path="layout.gap"] select.bd-unit-select',
    ) as HTMLSelectElement;
    expect(menu.getAttribute('aria-label')).toContain('Unit');
    expect(menu.value).toBe('px');
    expect(inputAt('layout.gap').value).toBe('10');
  });

  it('never steps to a value outside the grammar', async () => {
    const store = await mount();
    const input = inputAt('layout.gap');
    await type(input, 'auto');
    await press(input, 'ArrowUp');
    expect(input.value).toBe('auto');
    expect(styles(store)?.base?.layout?.gap).toBe('$space.4');
  });

  it('moves linked sides together as one undo step', async () => {
    const store = await mount();
    await type(inputAt('spacing.margin.left'), '12px');
    const margin = styles(store)?.base?.spacing?.margin;
    expect(margin).toEqual({ top: '12px', right: '12px', bottom: '12px', left: '12px' });
    await act(async () => {
      store.undo();
    });
    expect(styles(store)?.base?.spacing?.margin?.left).toBeUndefined();
    expect(styles(store)?.base?.spacing?.margin?.right).toBeUndefined();
  });

  it('writes only one side once the sides are unlinked', async () => {
    const store = await mount();
    await act(async () => buttonNamed('Padding: Link sides').click());
    await type(inputAt('spacing.padding.bottom'), '$space.2');
    expect(styles(store)?.base?.spacing?.padding).toEqual({ bottom: '$space.2' });
  });

  it('writes the same command as typing when a segment is pressed, and unsets on a second press', async () => {
    const store = await mount();
    await act(async () => buttonNamed('column').click());
    expect(styles(store)?.base?.layout?.direction).toBe('column');
    const group = container.querySelector('[data-style-prop="layout.direction"] fieldset');
    expect(group?.querySelector('[aria-pressed=true]')?.getAttribute('aria-label')).toBe('column');
    await act(async () => buttonNamed('column').click());
    expect(styles(store)?.base?.layout?.direction).toBeUndefined();
  });

  it('keeps keywords without a segment reachable through the other-values menu', async () => {
    const store = await mount();
    const select = container.querySelector(
      '[data-style-prop="layout.justify"] select',
    ) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toContain('space-evenly');
    await act(async () => {
      select.value = 'space-evenly';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(styles(store)?.base?.layout?.justify).toBe('space-evenly');
  });

  it('marks where a value comes from', async () => {
    await mount('mobile');
    const origin = (path: string) =>
      container.querySelector(`[data-style-prop="${path}"]`)?.getAttribute('data-origin');
    expect(origin('layout.gap')).toBe('inherited');
    expect(origin('layout.rowGap')).toBe('default');
    await mount('tablet');
    expect(origin('layout.display')).toBe('set');
    const dot = container.querySelector('[data-style-prop="layout.display"] .bd-source-dot');
    expect(dot?.getAttribute('aria-label')).toBe('Set on this breakpoint');
  });

  it('picks a token from the picker, which writes the token reference', async () => {
    const store = await mount();
    await act(async () => buttonNamed('Tokens: Gap').click());
    const token = [...document.querySelectorAll('.bd-token')].find((b) =>
      b.textContent?.startsWith('2'),
    ) as HTMLElement | undefined;
    expect(token).toBeDefined();
    await act(async () => token?.click());
    expect(styles(store)?.base?.layout?.gap).toBe('$space.2');
  });

  it('has no accessibility violations', async () => {
    await mount();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('template v2 inspector controls', () => {
  it('remembers a collapsed unused style section after unmount, without changing the document', async () => {
    const store = await mount();
    const initial = store.getState().doc;
    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-group="spacing"] .bd-sec__head',
    );
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    await act(async () => toggle?.click());
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(store.getState().doc).toBe(initial);
    await act(async () => root.render(null));
    await mount();
    expect(
      container
        .querySelector('[data-group="spacing"] .bd-sec__head')
        ?.getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('ignores malformed stored preferences and searches localized property labels', async () => {
    localStorage.setItem('buildr.editor.inspector.styles', '{"layout":"invalid"}');
    const store = await mount();
    const initial = store.getState().doc;
    const search = container.querySelector<HTMLInputElement>('.bd-inspector-search input');
    if (search === null) throw new Error('search missing');
    await type(search, 'gap');
    expect(container.querySelector('[data-style-prop="layout.gap"]')).not.toBeNull();
    expect(container.querySelector('[data-style-prop="layout.display"]')).toBeNull();
    expect(container.querySelector('[data-group="spacing"]')).toBeNull();
    await type(search, 'no such setting');
    expect(container.textContent).toContain('No settings “no such setting”');
    expect(store.getState().doc).toBe(initial);
  });

  it('uses two existing style commands for the flex pad, one undo step, and redo', async () => {
    const store = await mount();
    await act(async () => buttonNamed('flex').click());
    const dispatch = vi.spyOn(store, 'dispatchBatch');
    const pad = container.querySelector('[aria-label="Content alignment"]');
    const pick = pad?.querySelector<HTMLButtonElement>('[aria-label="bottom right"]');
    await act(async () => pick?.click());
    expect(dispatch).toHaveBeenCalledWith(
      [
        {
          type: 'node.setStyle',
          payload: {
            id: 'box0000001',
            layer: {},
            group: 'layout',
            property: 'justify',
            value: 'flex-end',
          },
        },
        {
          type: 'node.setStyle',
          payload: {
            id: 'box0000001',
            layer: {},
            group: 'layout',
            property: 'align',
            value: 'flex-end',
          },
        },
      ],
      { label: 'Content alignment' },
    );
    expect(styles(store)?.base?.layout).toMatchObject({ justify: 'flex-end', align: 'flex-end' });
    await act(async () => {
      store.undo();
    });
    expect(styles(store)?.base?.layout?.justify).toBeUndefined();
    expect(styles(store)?.base?.layout?.align).toBeUndefined();
    expect(styles(store)?.base?.layout?.display).toBe('flex');
    await act(async () => {
      store.redo();
    });
    expect(styles(store)?.base?.layout?.justify).toBe('flex-end');
  });

  it('scrubs validated lengths through node.setStyle and rejects negative padding', async () => {
    const store = await mount();
    await type(inputAt('layout.gap'), '10px');
    const dispatch = vi.spyOn(store, 'dispatch');
    const label = container.querySelector<HTMLElement>(
      '[data-style-prop="layout.gap"] label.bd-scrub-label',
    );
    if (label === null) throw new Error('scrub label missing');
    await act(async () => {
      label.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10 }));
      label.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 19 }));
      label.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'node.setStyle',
      payload: { id: 'box0000001', layer: {}, group: 'layout', property: 'gap', value: '13px' },
    });
    const before = styles(store)?.base?.spacing;
    await type(inputAt('spacing.padding.top'), '-5px');
    expect(styles(store)?.base?.spacing).toEqual(before);
  });

  it('writes linked and unlinked corners and borders through commands at the active device', async () => {
    const store = await mount('mobile', ['border']);
    const dispatch = vi.spyOn(store, 'dispatch');
    await type(inputAt('border.radius.topLeft'), '8px');
    expect(styles(store)?.bp?.['mobile']?.border?.radius).toEqual({
      topLeft: '8px',
      topRight: '8px',
      bottomRight: '8px',
      bottomLeft: '8px',
    });
    await act(async () => {
      store.undo();
    });
    expect(styles(store)?.bp?.['mobile']?.border?.radius).toBeUndefined();
    await act(async () => {
      store.redo();
    });
    expect(styles(store)?.bp?.['mobile']?.border?.radius?.bottomRight).toBe('8px');
    await act(async () => buttonNamed('Border: Link sides').click());
    await type(inputAt('border.width.left'), '2px');
    expect(styles(store)?.bp?.['mobile']?.border?.width).toEqual({ left: '2px' });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'node.setStyle',
      payload: {
        id: 'box0000001',
        layer: { bp: 'mobile' },
        group: 'border',
        property: 'width',
        side: 'left',
        value: '2px',
      },
    });
    expect(
      container
        .querySelector('[data-style-prop="border.width"] .bd-device-indicator')
        ?.getAttribute('data-override'),
    ).toBe('true');
    await act(async () => buttonNamed('Restore default: Border').click());
    expect(styles(store)?.bp?.['mobile']?.border?.width).toBeUndefined();
  });

  it('uses only theme shadow tokens and validates colour edits before dispatch', async () => {
    const store = await mount('mobile', ['effects', 'background']);
    const dispatch = vi.spyOn(store, 'dispatch');
    const preset = container.querySelector<HTMLButtonElement>(
      '.bd-shadow-presets button:nth-child(2)',
    );
    await act(async () => preset?.click());
    const token = `$shadow.${Object.keys(defaultTheme.tokens.shadow)[0]}`;
    expect(styles(store)?.bp?.['mobile']?.effects?.shadow).toBe(token);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'node.setStyle',
      payload: {
        id: 'box0000001',
        layer: { bp: 'mobile' },
        group: 'effects',
        property: 'shadow',
        value: token,
      },
    });
    const color = container.querySelector<HTMLButtonElement>(
      '[data-style-prop="background.color"] .bd-color-trigger',
    );
    await act(async () => color?.click());
    const input = document.querySelector<HTMLInputElement>('.bd-color-hex input');
    if (input === null) throw new Error('colour field missing');
    dispatch.mockClear();
    await type(input, 'url(https://example.com)');
    expect(dispatch).not.toHaveBeenCalled();
    await type(input, '#12345680');
    expect(styles(store)?.bp?.['mobile']?.background?.color).toBe('#12345680');
    expect(dispatch).toHaveBeenCalledWith({
      type: 'node.setStyle',
      payload: {
        id: 'box0000001',
        layer: { bp: 'mobile' },
        group: 'background',
        property: 'color',
        value: '#12345680',
      },
    });
    await act(async () => {
      store.undo();
    });
    expect(styles(store)?.bp?.['mobile']?.background?.color).toBeUndefined();
  });

  it('does not allow writes to a readonly document and exposes accessible supported widgets', async () => {
    await mount('mobile', ['effects', 'border', 'background'], true);
    for (const toggle of container.querySelectorAll<HTMLButtonElement>(
      '.bd-sec__head[aria-expanded=false]',
    )) {
      await act(async () => toggle.click());
    }
    for (const control of container.querySelectorAll<
      HTMLInputElement | HTMLButtonElement | HTMLSelectElement
    >('[data-style-prop] input, [data-style-prop] button, [data-style-prop] select')) {
      expect(control.disabled).toBe(true);
    }
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('template gradient and image position widgets', () => {
  it('writes a linear gradient and image position through validated style commands', async () => {
    const store = await mount('mobile', ['background']);
    const dispatch = vi.spyOn(store, 'dispatch');
    const angle = container.querySelector<HTMLInputElement>(
      '.bd-gradient-angle input:not([type=range])',
    );
    if (angle === null) throw new Error('gradient angle missing');
    await type(angle, '90');
    const names = Object.keys(defaultTheme.tokens.color);
    const gradient = `linear-gradient(90deg, $color.${names[0]}, $color.${names[1] ?? names[0]})`;
    expect(styles(store)?.bp?.['mobile']?.background?.gradient).toBe(gradient);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'node.setStyle',
      payload: {
        id: 'box0000001',
        layer: { bp: 'mobile' },
        group: 'background',
        property: 'gradient',
        value: gradient,
      },
    });
    const pad = container.querySelector(
      '[data-style-prop="background.imagePosition"] .bd-alignment-pad',
    );
    await act(async () =>
      pad?.querySelector<HTMLButtonElement>('[aria-label="top left"]')?.click(),
    );
    expect(styles(store)?.bp?.['mobile']?.background?.imagePosition).toBe('top left');
    await act(async () => {
      store.undo();
    });
    expect(styles(store)?.bp?.['mobile']?.background?.imagePosition).toBeUndefined();
    expect(styles(store)?.bp?.['mobile']?.background?.gradient).toBe(gradient);
    await act(async () => {
      store.redo();
    });
    expect(styles(store)?.bp?.['mobile']?.background?.imagePosition).toBe('top left');
  });

  it('keeps a gradient with more than two stops editable without silently simplifying it', async () => {
    const store = await mount(undefined, ['background']);
    const gradient = 'linear-gradient(180deg, #123456, #456789, #abcdef)';
    await type(inputAt('background.gradient'), gradient);
    expect(styles(store)?.base?.background?.gradient).toBe(gradient);
    expect(container.querySelector('.bd-gradient-fields')).toBeNull();
  });
});

describe('template width modes', () => {
  it('writes existing width values for automatic and full width, while Custom focuses the input', async () => {
    const store = await mount(undefined, ['size']);
    const mode = container.querySelector('[aria-label="Width mode"]');
    const pick = async (value: string) =>
      act(async () => {
        [...(mode?.querySelectorAll('button') ?? [])]
          .find((button) => button.textContent === value)
          ?.click();
      });
    await pick('Full');
    expect(styles(store)?.base?.size?.width).toBe('100%');
    await pick('Auto');
    expect(styles(store)?.base?.size?.width).toBe('auto');
    expect(
      [...(mode?.querySelectorAll('button') ?? [])]
        .find((button) => button.textContent === 'Auto')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    await type(inputAt('size.width'), 'fit-content');
    expect(
      [...(mode?.querySelectorAll('button') ?? [])]
        .find((button) => button.textContent === 'Auto')
        ?.getAttribute('aria-pressed'),
    ).toBe('false');
    await pick('Custom');
    expect(document.activeElement).toBe(inputAt('size.width'));
    await type(inputAt('size.width'), '340px');
    expect(styles(store)?.base?.size?.width).toBe('340px');
  });
});

describe('template hover styles', () => {
  it('resets state and search on selection, restores accordion preferences, and opens used sections', async () => {
    const store = await mount(undefined, [
      'layout',
      'background',
      'effects',
      'spacing',
      'visibility',
    ]);
    const sectionButton = (name: string) =>
      container.querySelector<HTMLButtonElement>(`[data-group="${name}"] .bd-sec__head`);
    await act(async () => sectionButton('layout')?.click());
    await act(async () => sectionButton('spacing')?.click());
    await act(async () => {
      store.dispatch({
        type: 'node.setStyle',
        payload: { id: 'root', layer: {}, group: 'layout', property: 'display', value: 'flex' },
      });
    });
    await act(async () => buttonNamed('Hover').click());
    await type(
      container.querySelector<HTMLInputElement>('.bd-inspector-search input') as HTMLInputElement,
      'color',
    );
    await act(async () => store.select('root'));
    expect(container.querySelector('.bd-styles')?.getAttribute('data-layer')).toBe('base');
    expect(container.querySelector<HTMLInputElement>('.bd-inspector-search input')?.value).toBe('');
    expect(sectionButton('layout')?.getAttribute('aria-expanded')).toBe('true');
    expect(sectionButton('spacing')?.getAttribute('aria-expanded')).toBe('false');
    await act(async () => sectionButton('visibility')?.click());
    expect(sectionButton('visibility')?.getAttribute('aria-expanded')).toBe('true');
    await act(async () => store.select('box0000001'));
    expect(sectionButton('visibility')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('translates the source of values in every pseudo-state', async () => {
    await mount(undefined, ['effects']);
    for (const label of ['Hover', 'Focus', 'Pressed']) {
      await act(async () => buttonNamed(label).click());
      const select = container.querySelector<HTMLSelectElement>(
        '[data-style-prop="effects.cursor"] select',
      );
      if (select === null) throw new Error('cursor select missing');
      await act(async () => {
        select.value = 'pointer';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(select.textContent).toContain(`pointer (${label})`);
      expect(select.textContent).not.toContain('state:');
    }
  });

  it('stores the selected palette token for colors and gradient stops', async () => {
    const store = await mount(undefined, ['background']);
    const name = Object.keys(defaultTheme.tokens.color)[0] as string;
    const token = `$color.${name}`;
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-style-prop="background.color"] .bd-color-trigger',
    );
    await act(async () => trigger?.click());
    // The newest popover: the previous one may still be closing.
    const pick = () =>
      [
        ...document.querySelectorAll<HTMLButtonElement>(
          `.bd-color-palette button[aria-label="${name}"]`,
        ),
      ].at(-1);
    await act(async () => pick()?.click());
    expect(styles(store)?.base?.background?.color).toBe(token);
    await act(async () =>
      document
        .querySelector('.bd-color-popover')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    const stops = container.querySelectorAll<HTMLButtonElement>(
      '.bd-gradient-stop .bd-color-trigger',
    );
    expect(stops).toHaveLength(2);
    await act(async () => stops[1]?.click());
    await act(async () => pick()?.click());
    expect(styles(store)?.base?.background?.gradient).toBe(
      `linear-gradient(180deg, ${token}, ${token})`,
    );
  });

  it('edits allowed visual properties through existing state-layer commands, with undo and redo', async () => {
    const store = await mount('mobile', ['layout', 'effects', 'background']);
    const dispatch = vi.spyOn(store, 'dispatch');
    await act(async () => buttonNamed('Hover').click());
    expect(container.querySelector('[data-group="layout"]')).toBeNull();
    expect(container.querySelector('[data-style-prop="effects.cursor"]')).not.toBeNull();
    await type(inputAt('background.color'), '#123456');
    expect(dispatch).toHaveBeenCalledWith({
      type: 'node.setStyle',
      payload: {
        id: 'box0000001',
        layer: { state: 'hover' },
        group: 'background',
        property: 'color',
        value: '#123456',
      },
    });
    expect(styles(store)?.state?.hover?.background?.color).toBe('#123456');
    expect(styles(store)?.bp?.['mobile']?.background?.color).toBeUndefined();
    await act(async () => {
      store.undo();
    });
    expect(styles(store)?.state?.hover?.background?.color).toBeUndefined();
    await act(async () => {
      store.redo();
    });
    expect(styles(store)?.state?.hover?.background?.color).toBe('#123456');
    await act(async () => buttonNamed('Restore default: Color').click());
    expect(styles(store)?.state?.hover?.background?.color).toBeUndefined();
  });
});

describe('style sections chrome (PB-157 WP5a)', () => {
  const head = (name: string) =>
    container.querySelector<HTMLButtonElement>(`[data-group="${name}"] .bd-sec__head`);

  it('highlights the matched label text and shows a no-results state', async () => {
    await mount();
    const search = container.querySelector<HTMLInputElement>('.bd-inspector-search input');
    if (search === null) throw new Error('search missing');
    await type(search, 'GAP');
    expect(
      container.querySelector('[data-style-prop="layout.gap"] .bd-field-label mark')?.textContent,
    ).toBe('Gap');
    await type(search, 'zzz');
    expect(container.querySelector('.bd-empty strong')?.textContent).toContain('zzz');
    expect(container.querySelector('[data-group]')).toBeNull();
  });

  it('keeps the remembered state when storage is corrupt or refuses writes', async () => {
    localStorage.setItem('buildr.editor.inspector.styles', 'not json {');
    await mount();
    expect(head('layout')?.getAttribute('aria-expanded')).toBe('true');
    expect(head('visibility')?.getAttribute('aria-expanded')).toBe('false');
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    await act(async () => head('layout')?.click());
    expect(head('layout')?.getAttribute('aria-expanded')).toBe('false');
    set.mockRestore();
  });

  it('counts the values set only at the breakpoint being edited', async () => {
    await mount('tablet');
    const chip = container.querySelector('[data-group="layout"] .bd-ovr');
    expect(chip?.textContent).toBe('1');
    expect(chip?.getAttribute('aria-label')).toContain('tablet');
    expect(container.querySelector('[data-group="spacing"] .bd-ovr')).toBeNull();
    expect(container.querySelector('.bd-note--ovr')?.textContent).toContain('tablet');
  });

  it('resets a section with unset commands only, as one undo step', async () => {
    const store = await mount('tablet');
    await act(async () => {
      store.dispatch({
        type: 'node.setStyle',
        payload: {
          id: 'box0000001',
          layer: { bp: 'tablet' },
          group: 'layout',
          property: 'gap',
          value: '8px',
        },
      });
    });
    expect(container.querySelector('[data-group="layout"] .bd-ovr')?.textContent).toBe('2');
    const dispatch = vi.spyOn(store, 'dispatch');
    const reset = container.querySelector<HTMLButtonElement>(
      '[data-group="layout"] .bd-sec__foot button',
    );
    await act(async () => reset?.click());
    const types = dispatch.mock.calls.map(([command]) => command.type);
    expect(types.length).toBe(2);
    expect(new Set(types)).toEqual(new Set(['node.unsetStyle']));
    expect(styles(store)?.bp?.['tablet']?.layout).toBeUndefined();
    expect(styles(store)?.base?.layout?.gap).toBe('$space.4');
    expect(container.querySelector('[data-group="layout"] .bd-sec__foot')).toBeNull();
    await act(async () => {
      store.undo();
    });
    expect(styles(store)?.bp?.['tablet']?.layout?.display).toBe('grid');
    expect(styles(store)?.bp?.['tablet']?.layout?.gap).toBe('8px');
  });

  it('expands and collapses every section from SectionsToggle', async () => {
    const store = await mount(undefined, ['layout', 'spacing', 'visibility']);
    const initial = store.getState().doc;
    await act(async () => buttonNamed('Expand all sections').click());
    for (const name of ['layout', 'spacing', 'visibility'])
      expect(head(name)?.getAttribute('aria-expanded')).toBe('true');
    expect(JSON.parse(localStorage.getItem('buildr.editor.inspector.styles') ?? '{}')).toEqual({
      layout: true,
      spacing: true,
      visibility: true,
    });
    await act(async () => buttonNamed('Collapse all sections').click());
    for (const name of ['layout', 'spacing', 'visibility'])
      expect(head(name)?.getAttribute('aria-expanded')).toBe('false');
    expect(store.getState().doc).toBe(initial);
  });

  it('hides min and max dimensions behind a disclosure', async () => {
    await mount(undefined, ['size']);
    expect(container.querySelector('[data-style-prop="size.minWidth"]')).toBeNull();
    await act(async () => buttonNamed('Min. and max. dimensions').click());
    expect(container.querySelector('[data-style-prop="size.minWidth"]')).not.toBeNull();
  });
});
