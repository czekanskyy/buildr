// @vitest-environment jsdom
import { createRegistryMeta, p } from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditorStore, EditorStoreProvider, useEditorState } from '../../store/index.ts';
import { ScrubLabel } from './scrub-label.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount(step = 1, initial = '5') {
  let time = 0;
  const store = createEditorStore({
    doc: {
      schemaVersion: 1,
      root: 'root',
      nodes: { root: { id: 'root', type: 'test/number' } },
      components: {},
    },
    registry: createRegistryMeta({
      components: [
        {
          type: 'test/number',
          version: 1,
          label: 'Number',
          category: 'content',
          contentCategories: ['flow'],
          props: { count: p.number({ default: 5 }) },
          styles: { groups: [] },
          runtime: 'shared',
        },
      ],
    }),
    validationDelayMs: null,
    history: { clock: () => time },
  });
  const dispatch = vi.spyOn(store, 'dispatch');
  function View() {
    const value = useEditorState((state) => state.doc.nodes['root']?.props?.['count']);
    return (
      <ScrubLabel
        htmlFor="count"
        value={value?.kind === 'static' ? String(value.value) : initial}
        step={step}
        min={0}
        max={10}
        disabled={false}
        onValueChange={(text) => {
          store.dispatch({
            type: 'node.setProp',
            payload: { id: 'root', prop: 'count', value: { kind: 'static', value: Number(text) } },
          });
        }}
      >
        Count
      </ScrubLabel>
    );
  }
  await act(async () =>
    root.render(
      <EditorStoreProvider store={store}>
        <View />
      </EditorStoreProvider>,
    ),
  );
  const pointer = async (type: string, clientX = 0, modifiers: MouseEventInit = {}) => {
    time += 1000;
    await act(async () =>
      container
        .querySelector('label')
        ?.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX, ...modifiers })),
    );
  };
  const value = () => store.getState().doc.nodes['root']?.props?.['count'];
  return { store, dispatch, pointer, value };
}

describe('ScrubLabel', () => {
  it('clamps both limits and respects the allowed step with Alt and Shift', async () => {
    const { pointer, value, dispatch } = await mount();
    await pointer('pointerdown');
    await pointer('pointermove', 9, { altKey: true });
    expect(dispatch).not.toHaveBeenCalled();
    await pointer('pointermove', 30, { altKey: true });
    expect(value()).toEqual({ kind: 'static', value: 6 });
    await pointer('pointermove', 300);
    expect(value()).toEqual({ kind: 'static', value: 10 });
    await pointer('pointermove', -300, { shiftKey: true });
    expect(value()).toEqual({ kind: 'static', value: 0 });
    await pointer('pointerup');
  });

  it('rounds fractional steps without floating point artifacts and rejects NaN', async () => {
    const { pointer, value } = await mount(0.1, '0.2');
    await pointer('pointerdown');
    await pointer('pointermove', 3);
    expect(value()).toEqual({ kind: 'static', value: 0.3 });
    await pointer('pointermove', 9, { altKey: true });
    expect(value()).toEqual({ kind: 'static', value: 0.2 });
    await pointer('pointerup');
    const invalid = await mount(1, 'NaN');
    await invalid.pointer('pointerdown');
    await invalid.pointer('pointermove', 30);
    expect(invalid.dispatch).not.toHaveBeenCalled();
    expect(invalid.store.history.inTransaction).toBe(false);
  });

  it('groups a slow gesture into exactly one undo step and keeps separate gestures separate', async () => {
    const { store, pointer, value, dispatch } = await mount();
    const before = store.getState().doc;
    await pointer('pointerdown');
    await pointer('pointermove', 3);
    await pointer('pointermove', 6);
    await pointer('pointermove', 9);
    await pointer('pointerup');
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(store.history.past).toHaveLength(1);
    expect(store.getState()).toMatchObject({
      inTransaction: false,
      canUndo: true,
      cursorId: store.history.cursorId,
    });
    await act(async () => {
      store.undo();
    });
    expect(store.getState().doc).toEqual(before);
    await act(async () => {
      store.redo();
    });
    expect(value()).toEqual({ kind: 'static', value: 8 });
    await pointer('pointerdown');
    await pointer('pointermove', 3);
    await pointer('pointercancel');
    expect(store.history.past).toHaveLength(2);
    expect(store.history.inTransaction).toBe(false);
    await pointer('pointerdown');
    await pointer('pointermove', -3);
    await act(async () => root.render(null));
    expect(store.history.inTransaction).toBe(false);
    expect(store.history.past).toHaveLength(3);
    expect(store.getState().inTransaction).toBe(false);
  });
});
