// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import type { LeftPanelTab } from '../app/contracts.ts';
import { MessagesProvider } from '../messages/index.tsx';
import { LeftPanel } from './left-panel.tsx';

expect.extend(matchers);
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

function Harness({ onCollapse }: { onCollapse: () => void }) {
  const [tab, setTab] = useState<LeftPanelTab>('blocks');
  return (
    <LeftPanel
      tab={tab}
      onTabChange={setTab}
      onCollapse={onCollapse}
      blocks={<p>blocks body</p>}
      structure={<p>structure body</p>}
    />
  );
}

async function mount(locale = 'en', onCollapse: () => void = () => {}) {
  await act(async () =>
    root.render(
      <MessagesProvider locale={locale}>
        <Harness onCollapse={onCollapse} />
      </MessagesProvider>,
    ),
  );
}
const tabs = () => [...container.querySelectorAll('[role=tab]')] as HTMLElement[];
const key = (el: Element, k: string) =>
  act(async () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  });

describe('LeftPanel', () => {
  it('is a labelled tablist with a tabpanel and no accessibility violations', async () => {
    await mount();
    expect(container.querySelector('[role=tablist]')?.getAttribute('aria-label')).toBe(
      'Left panel',
    );
    expect(tabs().map((t) => t.textContent)).toEqual(['Blocks', 'Structure']);
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1]);
    const panel = container.querySelector('[role=tabpanel]') as HTMLElement;
    expect(panel.textContent).toBe('blocks body');
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs()[0]?.id);
    expect(tabs()[0]?.getAttribute('aria-controls')).toBe(panel.id);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('switches by click and by arrow keys, wrapping, moving focus', async () => {
    await mount();
    await act(async () => tabs()[1]?.click());
    expect(container.querySelector('[role=tabpanel]')?.textContent).toBe('structure body');
    await key(tabs()[1] as HTMLElement, 'ArrowRight');
    expect(tabs()[0]?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs()[0]);
    await key(tabs()[0] as HTMLElement, 'ArrowLeft');
    expect(tabs()[1]?.getAttribute('aria-selected')).toBe('true');
    await key(tabs()[1] as HTMLElement, 'Home');
    expect(tabs()[0]?.getAttribute('aria-selected')).toBe('true');
    await key(tabs()[0] as HTMLElement, 'End');
    expect(tabs()[1]?.getAttribute('aria-selected')).toBe('true');
  });

  it('collapses with the collapse button', async () => {
    const onCollapse = vi.fn();
    await mount('en', onCollapse);
    const button = container.querySelector('button[aria-label="Collapse panel"]') as HTMLElement;
    await act(async () => button.click());
    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it('uses the Polish labels', async () => {
    await mount('pl');
    expect(tabs().map((t) => t.textContent)).toEqual(['Bloki', 'Struktura']);
  });
});
