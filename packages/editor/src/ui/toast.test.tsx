// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { MessagesProvider } from '../messages/index.tsx';
import { TOAST_MS, type ToastApi, ToastProvider, useToast } from './toast.tsx';

expect.extend(matchers);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let api: ToastApi;

function Probe() {
  api = useToast();
  return null;
}

beforeEach(async () => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <ToastProvider>
          <Probe />
        </ToastProvider>
      </MessagesProvider>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const status = () => container.querySelector('.bd-toast-region [role=status]') as HTMLElement;
const alert = () => container.querySelector('.bd-toast-region [role=alert]') as HTMLElement;
const show = (options: Parameters<ToastApi['show']>[0]) => act(() => void api.show(options));
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('toast region', () => {
  it('announces success, info and warning politely and errors as alerts', () => {
    expect(status().getAttribute('aria-live')).toBe('polite');
    show({ message: 'Saved', variant: 'success' });
    show({ message: 'Heads up', variant: 'warning' });
    show({ message: 'Broke', variant: 'error' });
    expect(status().textContent).toContain('Saved');
    expect(status().textContent).toContain('Heads up');
    expect(status().textContent).not.toContain('Broke');
    expect(alert().textContent).toContain('Broke');
    expect(container.querySelectorAll('.bd-toast')).toHaveLength(3);
  });

  it('dismisses after the timeout, and a persistent toast stays', () => {
    show({ message: 'Gone soon' });
    show({ message: 'Stays', duration: null });
    advance(TOAST_MS + 10);
    expect(status().textContent).not.toContain('Gone soon');
    expect(status().textContent).toContain('Stays');
  });

  it('pauses the countdown while hovered or focused', () => {
    show({ message: 'Hold on' });
    const toast = () => container.querySelector('.bd-toast') as HTMLElement;
    advance(TOAST_MS - 1000);
    act(() => void toast().dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    advance(TOAST_MS * 3);
    expect(status().textContent).toContain('Hold on');
    act(() => void toast().dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
    advance(1010);
    expect(status().textContent).not.toContain('Hold on');

    show({ message: 'Focus me' });
    const close = container.querySelector('.bd-toast-close') as HTMLButtonElement;
    act(() => close.focus());
    advance(TOAST_MS * 3);
    expect(status().textContent).toContain('Focus me');
  });

  it('replaces a toast with the same id and restarts its timer', () => {
    show({ id: 'n', message: 'First' });
    advance(TOAST_MS - 100);
    show({ id: 'n', message: 'Second' });
    advance(1000);
    expect(container.querySelectorAll('.bd-toast')).toHaveLength(1);
    expect(status().textContent).toContain('Second');
  });

  it('dismisses with the close button and runs an action', () => {
    const onSelect = vi.fn();
    show({ message: 'Newer', duration: null, action: { label: 'Reload', onSelect } });
    const reload = [...container.querySelectorAll('.bd-toast button')].find(
      (b) => b.textContent === 'Reload',
    ) as HTMLButtonElement;
    act(() => reload.click());
    expect(onSelect).toHaveBeenCalledOnce();
    const close = container.querySelector('button[aria-label="Dismiss notification"]');
    act(() => (close as HTMLButtonElement).click());
    expect(container.querySelector('.bd-toast')).toBeNull();
  });

  it('has no axe violations with every variant shown', async () => {
    vi.useRealTimers();
    for (const variant of ['success', 'info', 'warning', 'error'] as const) {
      show({ message: `A ${variant} message`, variant, detail: 'more', duration: null });
    }
    expect(await axe(container)).toHaveNoViolations();
  });
});
