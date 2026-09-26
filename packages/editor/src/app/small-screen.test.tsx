// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessagesProvider } from '../messages/index.tsx';
import { SmallScreenNotice, useViewportTooNarrow } from './small-screen.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  vi.unstubAllGlobals();
});

/** A window `width` wide whose width can change, answering `(max-width: Npx)` queries. */
function stubWindow(initial: number) {
  let width = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => {
    const max = Number(/max-width: (\d+)px/.exec(query)?.[1]);
    return {
      get matches() {
        return width <= max;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
  });
  return (next: number) => {
    width = next;
    for (const fn of listeners) fn();
  };
}

function Probe({ min }: { readonly min: number }) {
  return <p>{useViewportTooNarrow(min) ? 'narrow' : 'wide'}</p>;
}
const mount = async (node: React.ReactNode) => {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(node));
  return container;
};

describe('useViewportTooNarrow', () => {
  it('is true below the minimum and follows the window as it is resized', async () => {
    const resize = stubWindow(700);
    const view = await mount(<Probe min={1024} />);
    expect(view.textContent).toBe('narrow');
    await act(async () => resize(1280));
    expect(view.textContent).toBe('wide');
    await act(async () => resize(820));
    expect(view.textContent).toBe('narrow');
  });

  it('treats the minimum itself as wide enough, and 0 turns the check off', async () => {
    stubWindow(1024);
    expect((await mount(<Probe min={1024} />)).textContent).toBe('wide');
    act(() => root?.unmount());
    stubWindow(300);
    expect((await mount(<Probe min={0} />)).textContent).toBe('wide');
  });

  it('is false where matchMedia does not exist', async () => {
    vi.stubGlobal('matchMedia', undefined);
    expect((await mount(<Probe min={1024} />)).textContent).toBe('wide');
  });
});

describe('SmallScreenNotice', () => {
  it('asks for a computer, in the interface language, as an alert', async () => {
    const view = await mount(
      <MessagesProvider locale="pl">
        <SmallScreenNotice />
      </MessagesProvider>,
    );
    const alert = view.querySelector('[role="alert"]');
    expect(alert?.querySelector('h1')?.textContent).toBe('Edytor wymaga większego ekranu');
    expect(alert?.textContent).toContain('na komputerze');
  });
});
