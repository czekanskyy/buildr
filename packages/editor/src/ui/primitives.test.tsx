// @vitest-environment jsdom
import { act, type ReactNode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { MessagesProvider } from '../messages/index.tsx';
import {
  Button,
  ColorInput,
  ColorSwatch,
  ContextMenu,
  Dialog,
  hexOf,
  IconButton,
  Input,
  Kbd,
  MenuCheckboxItem,
  MenuLabel,
  MenuSeparator,
  NumberUnitInput,
  Popover,
  PortalContainerProvider,
  SearchField,
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

  it('Dialog returns focus to the element that opened it', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" id="opener" onClick={() => setOpen(true)}>
            Open
          </button>
          <Dialog open={open} onOpenChange={setOpen} title="Rename">
            <p>body</p>
          </Dialog>
        </>
      );
    }
    await show(<Host />);
    const opener = container.querySelector<HTMLButtonElement>('#opener');
    await act(async () => opener?.focus());
    await act(async () => opener?.click());
    expect(document.body.querySelector('[role=dialog]')).not.toBeNull();
    const close = document.body.querySelector<HTMLButtonElement>(
      'header button[aria-label="Close"]',
    );
    await act(async () => close?.click());
    expect(document.body.querySelector('[role=dialog]')).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
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
    const select = container.querySelector('select.bd-unit-select') as HTMLSelectElement;
    expect(select.value).toBe('px');
    expect([...select.options].map((o) => o.value)).toEqual(['px', 'rem']);
    expect(input.value).toBe('10');
    expect(stepNumberText('0.5', 0.1, '')).toBe('0.6');
    expect(stepNumberText('', 1, 'px')).toBe('1px');
    expect(stepNumberText('auto', 1, 'px')).toBeUndefined();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('NumberUnitInput: the menu picks the unit, typed digits keep it, a keyword disables the menu', async () => {
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
    const select = container.querySelector('select.bd-unit-select') as HTMLSelectElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      set?.call(select, 'rem');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onValueChange).toHaveBeenLastCalledWith('10rem');
    await show(
      <NumberUnitInput
        value="auto"
        onValueChange={onValueChange}
        units={['px', 'rem']}
        unitLabel="Unit"
        ariaLabel="Gap"
      />,
    );
    expect((container.querySelector('select.bd-unit-select') as HTMLSelectElement).disabled).toBe(
      true,
    );
  });

  it('hexOf and ColorInput: the native picker returns a hex colour', async () => {
    expect(hexOf('#abc')).toBe('#aabbcc');
    expect(hexOf('$color.primary')).toBeUndefined();
    const onColorChange = vi.fn();
    await show(<ColorInput color="#3f5ae0" label="Colour" onColorChange={onColorChange} />);
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label=Colour]')?.click(),
    );
    const native = document.querySelector('input[type=color]') as HTMLInputElement;
    expect(native.value).toBe('#3f5ae0');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps colour alpha when a palette or native picker changes hue, and returns focus on Escape', async () => {
    const onColorChange = vi.fn();
    await show(
      <ColorInput
        color="#1234567f"
        label="Colour"
        palette={[{ label: 'Brand', color: '#654321' }]}
        onColorChange={onColorChange}
      />,
    );
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label=Colour]');
    await act(async () => trigger?.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label=Brand]')?.click());
    expect(onColorChange).toHaveBeenLastCalledWith('#6543217f');
    const native = document.querySelector<HTMLInputElement>('input[type=color]');
    if (native === null) throw new Error('native colour picker missing');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        native,
        '#abcdef',
      );
      native.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onColorChange).toHaveBeenLastCalledWith('#abcdef7f');
    await act(async () => {
      native.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('.bd-color-popover')).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
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

describe('PB-157 primitives', () => {
  it('Dialog alert: role alertdialog, tone icon well, footer start, focus returns', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" id="opener" onClick={() => setOpen(true)}>
            Open
          </button>
          <Dialog
            open={open}
            onOpenChange={setOpen}
            title="Delete section"
            alert
            description="Removes the section"
            icon="triangle-alert"
            tone="danger"
            footerStart={<Button variant="text">History</Button>}
            footer={<Button variant="danger">Delete</Button>}
          >
            <p>body</p>
          </Dialog>
        </>
      );
    }
    await show(<Host />);
    const opener = container.querySelector<HTMLButtonElement>('#opener');
    await act(async () => opener?.focus());
    await act(async () => opener?.click());
    const dialog = document.body.querySelector('[role=alertdialog]');
    expect(dialog).not.toBeNull();
    expect(document.body.querySelector('[role=dialog]')).toBeNull();
    expect(dialog?.querySelector('.bd-dialog-icon')?.getAttribute('data-tone')).toBe('danger');
    expect(dialog?.querySelector('.bd-dialog-footer-start button')?.textContent).toBe('History');
    await act(async () =>
      document.body.querySelector<HTMLButtonElement>('header button[aria-label="Close"]')?.click(),
    );
    expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('Dialog without the new props renders as before', async () => {
    await show(
      <Dialog open onOpenChange={() => {}} title="Plain" footer={<Button>OK</Button>}>
        <p>body</p>
      </Dialog>,
    );
    const dialog = document.body.querySelector('[role=dialog]');
    expect(dialog).not.toBeNull();
    expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
    expect(dialog?.className).toBe('bd-dialog bd-dialog-in');
    expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
    const header = dialog?.querySelector(':scope > header.bd-dialog-header');
    expect([...(header?.children ?? [])].map((child) => child.className)).toEqual([
      'bd-dialog-heading',
      'bd-button bd-icon-button',
    ]);
    expect(header?.querySelector('.bd-dialog-title')?.textContent).toBe('Plain');
    expect(dialog?.querySelector(':scope > .bd-dialog-body')?.textContent).toBe('body');
    expect(dialog?.querySelector(':scope > footer.bd-dialog-footer > button')?.textContent).toBe(
      'OK',
    );
    expect(dialog?.querySelector('.bd-dialog-icon, .bd-dialog-footer-start')).toBeNull();
  });

  it('alert Dialog is described by its description', async () => {
    await show(
      <Dialog
        open
        onOpenChange={() => {}}
        title="Delete"
        description="This cannot be undone"
        alert
      />,
    );
    const dialog = document.body.querySelector('[role=alertdialog]');
    const id = dialog?.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)?.textContent).toBe('This cannot be undone');
  });

  it('MenuCheckboxItem: aria-checked before and after, by pointer and by Enter and Space', async () => {
    const seen: boolean[] = [];
    function Host() {
      const [on, setOn] = useState(false);
      return (
        <ContextMenu
          label="Actions"
          items={[
            {
              id: 'copy',
              label: 'Copy',
              kbd: 'Ctrl+C',
              shortcut: 'Control+C',
              icon: 'copy',
              onSelect: () => {},
            },
            {
              id: 'wide',
              label: 'Wide',
              checked: true,
              danger: true,
              icon: 'eye',
              onSelect: () => {},
            },
          ]}
          content={
            <>
              <MenuSeparator />
              <MenuLabel>View</MenuLabel>
              <MenuCheckboxItem
                checked={on}
                onCheckedChange={(next) => {
                  seen.push(next);
                  setOn(next);
                }}
              >
                Grid
              </MenuCheckboxItem>
            </>
          }
        >
          <div id="area">area</div>
        </ContextMenu>
      );
    }
    await show(<Host />);
    const openMenu = () =>
      act(async () => {
        container.querySelector('#area')?.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 5,
            clientY: 5,
          }),
        );
      });
    const grid = () =>
      [...document.body.querySelectorAll('[role=menuitemcheckbox]')].find((el) =>
        el.textContent?.includes('Grid'),
      ) as HTMLElement;
    await openMenu();
    expect(grid().getAttribute('aria-checked')).toBe('false');
    const copy = document.body.querySelector('[role=menuitem]');
    expect(copy?.getAttribute('aria-keyshortcuts')).toBe('Control+C');
    expect(copy?.querySelector('.bd-kbd')?.getAttribute('aria-hidden')).toBe('true');
    const wide = [...document.body.querySelectorAll('[role=menuitemcheckbox]')].find((el) =>
      el.textContent?.includes('Wide'),
    );
    expect(wide?.getAttribute('aria-checked')).toBe('true');
    expect(wide?.hasAttribute('data-danger')).toBe(true);
    expect(wide?.querySelector('[data-icon="eye"]')).not.toBeNull();
    expect(document.body.querySelector('.bd-menu-caption')?.textContent).toBe('View');
    expect(document.body.querySelector('[role=separator]')).not.toBeNull();
    await act(async () => {
      grid().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(seen).toEqual([true]);
    await openMenu();
    expect(grid().getAttribute('aria-checked')).toBe('true');
    for (const key of ['Enter', ' ']) {
      await act(async () => {
        grid().focus();
        grid().dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
        );
      });
      await openMenu();
    }
    expect(seen).toEqual([true, false, true]);
    expect(grid().getAttribute('aria-checked')).toBe('true');
  });

  it('Kbd renders a kbd element', async () => {
    await show(<Kbd>Ctrl+K</Kbd>);
    const kbd = container.querySelector('kbd');
    expect(kbd?.className).toContain('bd-kbd');
    expect(kbd?.textContent).toBe('Ctrl+K');
  });

  const typeInto = (input: HTMLInputElement | null, text: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
  const pressEscape = (target: Element | null) =>
    act(async () => {
      target?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });

  function Search({ disabled }: { readonly disabled?: boolean }) {
    const [value, setValue] = useState('');
    return (
      <SearchField
        value={value}
        onChange={setValue}
        label="Search blocks"
        clearLabel="Clear search"
        hint="/"
        {...(disabled === true ? { disabled } : {})}
      />
    );
  }

  it('SearchField: hint while empty, clear button once typed in, which empties and refocuses', async () => {
    await show(<Search />);
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search blocks"]');
    expect(container.querySelector('kbd')?.textContent).toBe('/');
    expect(container.querySelector('[aria-label="Clear search"]')).toBeNull();
    await typeInto(input, 'hero');
    expect(input?.value).toBe('hero');
    expect(container.querySelector('kbd')).toBeNull();
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Clear search"]')?.click(),
    );
    expect(input?.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SearchField: Escape clears a non-empty field', async () => {
    await show(<Search />);
    const input = container.querySelector<HTMLInputElement>('input');
    await typeInto(input, 'hero');
    await pressEscape(input);
    expect(input?.value).toBe('');
  });

  it('SearchField in a Dialog: Escape clears first and closes the dialog only when empty', async () => {
    const onOpenChange = vi.fn();
    function Host() {
      const [value, setValue] = useState('');
      return (
        <Dialog open onOpenChange={onOpenChange} title="Find">
          <SearchField value={value} onChange={setValue} label="Find" clearLabel="Clear" />
        </Dialog>
      );
    }
    await show(<Host />);
    const input = document.body.querySelector<HTMLInputElement>('input[aria-label=Find]');
    input?.focus();
    await typeInto(input, 'hero');
    await pressEscape(input);
    expect(input?.value).toBe('');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role=dialog]')).not.toBeNull();
    await pressEscape(input);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('SearchField: disabled blocks input and the clear button', async () => {
    await show(
      <SearchField
        value="hero"
        onChange={() => {}}
        label="Search blocks"
        clearLabel="Clear search"
        disabled
      />,
    );
    expect(container.querySelector('input')?.disabled).toBe(true);
    expect(
      container.querySelector<HTMLButtonElement>('[aria-label="Clear search"]')?.disabled,
    ).toBe(true);
  });

  it('IconButton has a sm size', async () => {
    await show(<IconButton label="More" icon="ellipsis" size="sm" />);
    expect(container.querySelector('button')?.className).toContain('bd-icon-button--sm');
  });
});
