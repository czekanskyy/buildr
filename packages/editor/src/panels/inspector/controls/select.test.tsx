// @vitest-environment jsdom
import { p, type SelectPropDef } from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MessagesProvider } from '../../../messages/index.tsx';
import { SelectControl } from './select.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

async function mount(def: SelectPropDef, value: unknown) {
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <SelectControl
          id="c"
          def={def}
          label="Display"
          describedBy={undefined}
          value={value}
          disabled={false}
          onChange={() => undefined}
        />
      </MessagesProvider>,
    ),
  );
  return container.querySelector('button[role=combobox]') as HTMLElement;
}

describe('SelectControl', () => {
  it('shows the label of the chosen option when the prop declares labels', async () => {
    const def = p.select({
      options: ['block', 'flex'],
      optionLabels: { block: 'Block', flex: 'Flex row or column' },
      default: 'block',
    });
    expect((await mount(def, 'flex')).textContent).toContain('Flex row or column');
  });

  it('shows the raw value when there are no labels, or none for that option', async () => {
    expect(
      (await mount(p.select({ options: ['sm', 'md'], default: 'md' }), 'sm')).textContent,
    ).toContain('sm');
    const partial = p.select({
      options: ['a', 'b'],
      optionLabels: { a: 'Alpha' },
      default: 'a',
    });
    expect((await mount(partial, 'b')).textContent).toContain('b');
  });
});
