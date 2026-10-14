// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
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
  const narrow = useViewportTooNarrow(min);
  return <p>{narrow === undefined ? 'unknown' : narrow ? 'narrow' : 'wide'}</p>;
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

/** What `EditorApp` shows: loading while unknown, the notice when narrow, else the editor. */
function Gate({ min }: { readonly min: number }) {
  const narrow = useViewportTooNarrow(min);
  if (narrow === undefined) return <p role="status">loading</p>;
  return narrow ? (
    <MessagesProvider locale="en">
      <SmallScreenNotice />
    </MessagesProvider>
  ) : (
    <p>editor</p>
  );
}

describe('useViewportTooNarrow on the server and while hydrating', () => {
  it('is unknown on the server, whatever the window would say', () => {
    stubWindow(700);
    const html = renderToString(<Gate min={1024} />);
    expect(html).toContain('loading');
    expect(html).not.toContain('role="alert"');
  });

  it('hydrates a narrow window without a mismatch, then shows the notice', async () => {
    stubWindow(700);
    const html = renderToString(<Gate min={1024} />);
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = html;
    const errors: unknown[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      root = hydrateRoot(container, <Gate min={1024} />, {
        onRecoverableError: (error) => errors.push(error),
      });
    });
    expect(errors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
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
