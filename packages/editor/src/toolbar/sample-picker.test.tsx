// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagesProvider } from '../messages/index.tsx';
import { SamplePicker } from './sample-picker.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ref = { collection: 'templates', id: '1' };
const samples = [
  { id: 'p1', label: 'First post' },
  { id: 'p2', label: 'Second post' },
];

describe('SamplePicker', () => {
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

  const store = (initial: Record<string, string> = {}) => {
    const data = { ...initial };
    return {
      data,
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value;
      },
    };
  };
  const mount = async (
    listSamples: (() => Promise<typeof samples>) | undefined,
    onChange: (ref: string | null) => void,
    storage: Pick<Storage, 'getItem' | 'setItem'> = store(),
  ) => {
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <SamplePicker
            adapter={{ listSamples } as never}
            docRef={ref}
            onChange={onChange}
            storage={storage}
          />
        </MessagesProvider>,
      ),
    );
  };

  it('renders nothing when there are no samples', async () => {
    await mount(undefined, () => undefined);
    expect(container.innerHTML).toBe('');
    await mount(
      async () => [],
      () => undefined,
    );
    expect(container.innerHTML).toBe('');
  });

  it('sends the remembered entry to the canvas', async () => {
    const onChange = vi.fn();
    await mount(async () => samples, onChange, store({ 'buildr:sample:templates:1': 'p2' }));
    expect(onChange).toHaveBeenCalledWith('p2');
    expect(container.textContent).toContain('Second post');
  });

  it('forgets a remembered entry that is gone, and survives broken storage', async () => {
    const onChange = vi.fn();
    await mount(async () => samples, onChange, store({ 'buildr:sample:templates:1': 'gone' }));
    expect(onChange).not.toHaveBeenCalled();
    const blocked = () => {
      throw new Error('blocked');
    };
    await mount(async () => samples, onChange, { getItem: blocked, setItem: blocked });
    expect(container.textContent).toContain('Default entry');
  });

  it('switching the entry tells the canvas and remembers it', async () => {
    const onChange = vi.fn();
    const storage = store();
    await mount(async () => samples, onChange, storage);
    await act(async () =>
      (container.querySelector('button[role=combobox]') as HTMLElement).click(),
    );
    const option = [...document.querySelectorAll('[role=option]')].find((o) =>
      o.textContent?.includes('First post'),
    ) as HTMLElement;
    await act(async () => {
      option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      option.click();
    });
    expect(onChange).toHaveBeenLastCalledWith('p1');
    expect(storage.data['buildr:sample:templates:1']).toBe('p1');
  });
});
