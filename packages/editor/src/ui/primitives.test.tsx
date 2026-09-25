// @vitest-environment jsdom
import { act, type ReactNode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { MessagesProvider } from '../messages/index.tsx';
import {
  Button,
  ColorSwatch,
  Dialog,
  IconButton,
  Input,
  NumberUnitInput,
  Popover,
  PortalContainerProvider,
  SegmentedControl,
  Select,
  stepNumberText,
  Tabs,
  Toggle,
} from './index.ts';

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
    const close = dialog?.querySelector<HTMLButtonElement>('header button[aria-label="Close"]');
    expect(close).not.toBeNull();
    await act(async () => close?.click());
    expect(document.body.querySelector('[role=dialog]')).toBeNull();
  });

  it('Dialog has a header, a scrollable body and a footer for actions, and passes axe', async () => {
    await show(
      <Dialog
        open
        onOpenChange={() => {}}
        title="Rename"
        footer={<Button variant="primary">Save</Button>}
      >
        <p>body</p>
      </Dialog>,
    );
    const dialog = document.body.querySelector('[role=dialog]') as HTMLElement;
    expect(dialog.querySelector('header .bd-dialog-title')?.textContent).toBe('Rename');
    expect(dialog.querySelector('.bd-dialog-body')?.textContent).toBe('body');
    expect(dialog.querySelector('footer button')?.textContent).toBe('Save');
    expect(await axe(dialog)).toHaveNoViolations();
  });

  it('Dialog can hide its close button', async () => {
    await show(
      <Dialog open onOpenChange={() => {}} title="Choose" hideClose>
        <p>body</p>
      </Dialog>,
    );
    expect(document.body.querySelector('[role=dialog] header button')).toBeNull();
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

  it('floating layers render inside the portal container, so they inherit its theme', async () => {
    const themed = document.createElement('div');
    themed.setAttribute('data-theme', 'dark');
    document.body.append(themed);
    await show(
      <PortalContainerProvider container={themed}>
        <Popover trigger={<Button>Open</Button>}>
          <p>inside</p>
        </Popover>
      </PortalContainerProvider>,
    );
    await act(async () => container.querySelector('button')?.click());
    expect(themed.textContent).toContain('inside');
    expect(themed.closest('[data-theme=dark]')).toBe(themed);
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

  it('SegmentedControl: exclusive pressed state, icon-only names, axe', async () => {
    const onValueChange = vi.fn();
    await show(
      <SegmentedControl
        label="Direction"
        value="row"
        onValueChange={onValueChange}
        options={[
          { value: 'row', label: 'Row', icon: 'arrow-right', iconOnly: true },
          { value: 'column', label: 'Column', icon: 'arrow-down', iconOnly: true },
        ]}
      />,
    );
    const [row, column] = container.querySelectorAll('button');
    expect(container.querySelector('fieldset')?.getAttribute('aria-label')).toBe('Direction');
    expect(row?.getAttribute('aria-pressed')).toBe('true');
    expect(column?.getAttribute('aria-pressed')).toBe('false');
    expect(column?.getAttribute('aria-label')).toBe('Column');
    await act(async () => column?.click());
    expect(onValueChange).toHaveBeenCalledWith('column');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('NumberUnitInput: arrows step, Shift takes ten, bare numbers stay bare', async () => {
    const onValueChange = vi.fn();
    await show(
      <NumberUnitInput
        value="10px"
        onValueChange={onValueChange}
        units={['px', 'rem']}
        unitLabel="Unit"
        ariaLabel="Gap"
      />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    const key = (init: KeyboardEventInit) =>
      act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
      });
    await key({ key: 'ArrowUp' });
    await key({ key: 'ArrowDown', shiftKey: true });
    expect(onValueChange.mock.calls).toEqual([['11px'], ['0px']]);
    expect(container.querySelector('.bd-select-trigger')?.textContent).toContain('px');
    expect(stepNumberText('0.5', 0.1, '')).toBe('0.6');
    expect(stepNumberText('', 1, 'px')).toBe('1px');
    expect(stepNumberText('auto', 1, 'px')).toBeUndefined();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ColorSwatch paints only colour notations, never raw CSS', async () => {
    await show(
      <>
        <ColorSwatch color="#3f5ae0" />
        <ColorSwatch color="url(https://x.test/a.png)" />
        <ColorSwatch color={undefined} />
      </>,
    );
    const [ok, bad, none] = [...container.querySelectorAll('.bd-swatch')] as HTMLElement[];
    expect(ok?.style.backgroundColor).not.toBe('');
    expect(bad?.getAttribute('style')).toBeNull();
    expect(none?.hasAttribute('data-empty')).toBe(true);
  });
});
