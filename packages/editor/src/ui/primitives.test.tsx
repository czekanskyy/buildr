// @vitest-environment jsdom
import { act, type ReactNode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { MessagesProvider } from '../messages/index.tsx';
import { Button, Dialog, IconButton, Input, Popover, Select, Tabs, Toggle } from './index.ts';

expect.extend(matchers);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  // Radix measures with ResizeObserver and scrolls items into view.
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const show = async (node: ReactNode) => {
  await act(async () => root.render(<MessagesProvider locale="en">{node}</MessagesProvider>));
};

describe('UI primitives', () => {
  it('Button and IconButton: variants, click, and a required accessible name', async () => {
    const onClick = vi.fn();
    await show(
      <>
        <Button variant="primary" onClick={onClick}>
          Save
        </Button>
        <IconButton label="Undo" icon="undo-2" onClick={onClick} />
      </>,
    );
    const [save, undo] = container.querySelectorAll('button');
    expect(save?.getAttribute('data-variant')).toBe('primary');
    expect(save?.getAttribute('type')).toBe('button');
    expect(undo?.getAttribute('aria-label')).toBe('Undo');
    await act(async () => save?.click());
    await act(async () => undo?.click());
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Input passes its props through', async () => {
    await show(<Input aria-label="Title" defaultValue="Hi" />);
    const input = container.querySelector('input');
    expect(input?.value).toBe('Hi');
    expect(input?.className).toContain('bd-input');
  });

  it('Tabs show the active panel', async () => {
    await show(
      <Tabs
        label="Sections"
        value="b"
        items={[
          { value: 'a', label: 'Alpha', content: <p>first</p> },
          { value: 'b', label: 'Beta', content: <p>second</p> },
        ]}
      />,
    );
    expect(container.textContent).toContain('second');
    expect(container.textContent).not.toContain('first');
    const tabs = [...container.querySelectorAll('[role=tab]')].map((t) => [
      t.textContent,
      t.getAttribute('aria-selected'),
    ]);
    expect(tabs).toEqual([
      ['Alpha', 'false'],
      ['Beta', 'true'],
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Toggle reports its state', async () => {
    const seen: boolean[] = [];
    function Host() {
      const [on, setOn] = useState(false);
      return (
        <Toggle
          pressed={on}
          onPressedChange={(v) => {
            seen.push(v);
            setOn(v);
          }}
          label="Bold"
        >
          B
        </Toggle>
      );
    }
    await show(<Host />);
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-pressed')).toBe('false');
    await act(async () => button?.click());
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(seen).toEqual([true]);
  });

  it('Dialog opens with a title, and closes with its button', async () => {
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog open={open} onOpenChange={setOpen} title="Rename" description="Pick a name">
          <p>body</p>
        </Dialog>
      );
    }
    await show(<Host />);
    const dialog = document.body.querySelector('[role=dialog]');
    expect(dialog?.textContent).toContain('Rename');
    expect(dialog?.getAttribute('aria-labelledby')).not.toBeNull();
    const close = [...(dialog?.querySelectorAll('button') ?? [])].find(
      (b) => b.textContent === 'Close',
    );
    await act(async () => close?.click());
    expect(document.body.querySelector('[role=dialog]')).toBeNull();
  });

  it('Popover opens from its trigger', async () => {
    await show(
      <Popover trigger={<Button>Open</Button>}>
        <p>inside</p>
      </Popover>,
    );
    expect(document.body.textContent).not.toContain('inside');
    await act(async () => container.querySelector('button')?.click());
    expect(document.body.textContent).toContain('inside');
  });

  it('Select shows the chosen option and names its control', async () => {
    await show(
      <Select
        label="Breakpoint"
        value="b"
        onValueChange={() => {}}
        options={[
          { value: 'a', label: 'Desktop' },
          { value: 'b', label: 'Tablet' },
        ]}
      />,
    );
    const trigger = container.querySelector('button');
    expect(trigger?.getAttribute('aria-label')).toBe('Breakpoint');
    expect(trigger?.textContent).toContain('Tablet');
  });
});
