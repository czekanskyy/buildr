// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessagesProvider } from '../messages/index.tsx';
import { EditableTitle } from './editable-title.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

const mount = async (onRename: (title: string) => Promise<void>) => {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      <MessagesProvider locale="en">
        <EditableTitle title="Home" onRename={onRename} />
      </MessagesProvider>,
    ),
  );
  const input = container.querySelector('input') as HTMLInputElement;
  await act(async () => input.focus());
  return input;
};
const type = async (input: HTMLInputElement, text: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const key = (input: HTMLInputElement, name: string) =>
  act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  });

describe('EditableTitle', () => {
  it('saves a trimmed name on Enter', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const input = await mount(onRename);
    await type(input, '  About ');
    await key(input, 'Enter');
    expect(onRename).toHaveBeenCalledWith('About');
  });

  it('puts the old name back on Escape and never saves an empty name', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const input = await mount(onRename);
    await type(input, 'Other');
    await key(input, 'Escape');
    expect(input.value).toBe('Home');
    await act(async () => input.focus());
    await type(input, '   ');
    await act(async () => input.blur());
    expect(onRename).not.toHaveBeenCalled();
    expect(input.value).toBe('Home');
  });

  it('reverts when the backend refuses', async () => {
    const input = await mount(() => Promise.reject(new Error('no')));
    await type(input, 'Nope');
    await key(input, 'Enter');
    expect(input.value).toBe('Home');
  });
});
