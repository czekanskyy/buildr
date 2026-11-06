// @vitest-environment jsdom
import type { BuilderDocument } from '@next-buildr/core';
import { afterEach, expect, it, vi } from 'vitest';
import { createCanvasStore } from '../store.ts';
import { placeToolbar } from './affordances.ts';
import { createOverlay, type Overlay } from './overlay.ts';
import { OVERLAY_STYLE } from './palette.ts';

let overlay: Overlay | undefined;
afterEach(() => {
  overlay?.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function setup() {
  const store = createCanvasStore();
  store.setDocument(
    {
      root: 'root',
      nodes: {
        root: { id: 'root', type: 'test/root', slots: { children: ['a', 'b'] } },
        a: { id: 'a', type: 'test/heading', name: 'Heading' },
        b: { id: 'b', type: 'test/text' },
      },
    } as unknown as BuilderDocument,
    0,
  );
  store.update({ selection: ['a'] });
  const a = document.createElement('h2');
  a.setAttribute('data-bid', 'a');
  document.body.append(a);
  const b = document.createElement('p');
  b.setAttribute('data-bid', 'b');
  document.body.append(b);
  let top = 100;
  vi.spyOn(a, 'getBoundingClientRect').mockImplementation(
    () => ({ left: 20, top, bottom: top + 50, right: 220, width: 200, height: 50 }) as DOMRect,
  );
  vi.spyOn(b, 'getBoundingClientRect').mockReturnValue({
    left: 20,
    top: 170,
    bottom: 200,
    right: 220,
    width: 200,
    height: 30,
  } as DOMRect);
  const onAction = vi.fn();
  const onInsert = vi.fn();
  overlay = createOverlay({
    document,
    store,
    onAction,
    onInsert,
    onHandleDown: () => true,
    warn: false,
  });
  overlay.setView({
    labels: {
      selectParent: '<img onerror>',
      moveUp: 'Up',
      align: 'Align',
      alignLeft: 'Left',
      alignCenter: 'Center',
      alignRight: 'Right',
      insert: 'Insert',
    },
  });
  overlay.refresh();
  return {
    store,
    a,
    onAction,
    onInsert,
    shadow: overlay.host.shadowRoot as ShadowRoot,
    setTop: (value: number) => {
      top = value;
    },
  };
}
it('flips below and clamps to either viewport edge in local CSS pixels', () => {
  expect(placeToolbar({ left: 780, top: 100, bottom: 150 }, 800, 335)).toEqual({
    left: 465,
    top: 28,
  });
  expect(placeToolbar({ left: -20, top: 10, bottom: 60 }, 800, 335)).toEqual({ left: 0, top: 70 });
  // A tall block with no room above gets the toolbar inside its top edge, not over the next text.
  expect(placeToolbar({ left: 10, top: 0, bottom: 2000 }, 800, 335, 600).top).toBe(8);
  expect(placeToolbar({ left: 10, top: -300, bottom: 2000 }, 800, 335, 600).top).toBe(8);
  expect(placeToolbar({ left: 10, top: 0, bottom: 50 }, 800, 335, 600).top).toBe(60);
  // Flipped below: the gap and the room needed are the toolbar's own, so the toolbar stays on screen.
  expect(placeToolbar({ left: 10, top: 0, bottom: 580 }, 800, 335, 600).top).toBe(8);
  expect(placeToolbar({ left: 10, top: 500, bottom: 590 }, 800, 335, 600).top).toBe(428);
  expect(placeToolbar({ left: 10, top: 30, bottom: 590 }, 800, 335, 600).top).toBe(38);
  expect(placeToolbar({ left: 10, top: 10, bottom: 60 }, 800, 335, 600).top).toBe(70);
  // Parent iframe scaling does not change its internal viewport coordinates.
  expect(placeToolbar({ left: 20, top: 100, bottom: 150 }, 800, 335)).toEqual({
    left: 20,
    top: 28,
  });
});
it('counter-scales the toolbar and keeps its placement valid at any scale', () => {
  // At 0.5 the toolbar is drawn at 2x in iframe px: room above, margins and width all double.
  expect(placeToolbar({ left: 700, top: 200, bottom: 260 }, 800, 335, 600, 0.5)).toEqual({
    left: 130,
    top: 56,
  });
  expect(placeToolbar({ left: 10, top: 100, bottom: 160 }, 800, 335, 600, 0.5).top).toBe(180);
  expect(placeToolbar({ left: 10, top: 0, bottom: 2000 }, 800, 335, 600, 0.5).top).toBe(16);
  expect(placeToolbar({ left: 10, top: 300, bottom: 360 }, 800, 335, 600, Number.NaN)).toEqual(
    placeToolbar({ left: 10, top: 300, bottom: 360 }, 800, 335, 600, 1),
  );
  const { shadow } = setup();
  const handle = overlay as Overlay;
  handle.setView({ scale: 0.5 });
  handle.refresh();
  const toolbar = shadow.querySelector<HTMLElement>('.toolbar');
  expect(toolbar?.style.transform).toBe('scale(2)');
  expect(toolbar?.style.transformOrigin).toBe('0 0');
});
it('uses the editor-provided type labels and the parent action template as text', () => {
  const { shadow } = setup();
  const handle = overlay as Overlay;
  handle.setView({
    typeLabels: { 'test/root': 'Korzeń' },
    labels: { selectParentOf: 'Zaznacz element nadrzędny: {name}' },
  });
  handle.refresh();
  const parent = shadow.querySelector('.selectParent');
  expect(parent?.getAttribute('aria-label')).toBe('Zaznacz element nadrzędny: Korzeń');
  expect(parent?.getAttribute('title')).toBe('Zaznacz element nadrzędny: Korzeń');
});
it('sends action and insertion intents and treats labels solely as text', () => {
  const { shadow, onAction, onInsert } = setup();
  const click = (selector: string) => (shadow.querySelector(selector) as HTMLButtonElement).click();
  // Icon only: no visible text, the label is the accessible name and tooltip, never HTML.
  expect(shadow.querySelector('.selectParent')?.textContent).toBe('');
  // The parent's name (here its type) when it has one, else the generic label.
  expect(shadow.querySelector('.selectParent')?.getAttribute('aria-label')).toBe('test/root');
  expect(shadow.querySelector('.selectParent')?.getAttribute('title')).toBe('test/root');
  expect(shadow.querySelector('.tool.moveUp')?.getAttribute('aria-label')).toBe('Up');
  expect(shadow.querySelector('img')).toBeNull();
  click('.moveUp');
  expect(onAction).toHaveBeenLastCalledWith({ id: 'a', action: 'moveUp' });
  click('.align');
  click('.alignCenter');
  expect(onAction).toHaveBeenLastCalledWith(
    expect.objectContaining({
      id: 'a',
      action: 'align',
      value: 'center',
      point: expect.any(Object),
    }),
  );
  click('.more');
  expect(onAction).toHaveBeenLastCalledWith(
    expect.objectContaining({ action: 'more', point: expect.any(Object) }),
  );
  (shadow.querySelectorAll('.ins-btn')[1] as HTMLElement).click();
  expect(onInsert).toHaveBeenCalledWith(
    expect.objectContaining({ target: { parentId: 'root', slot: 'children', index: 1 } }),
  );
  expect(shadow.querySelector('.label')?.textContent).toBe('Heading · h2');
});
it('preserves partial view updates, draws outlines, dims hidden blocks and switches theme', () => {
  const { a, shadow } = setup();
  overlay?.setView({ outlines: true, hidden: ['a'], theme: 'dark' });
  overlay?.refresh();
  expect(shadow.querySelectorAll('.outline')).toHaveLength(2);
  expect(a.hasAttribute('data-buildr-dimmed')).toBe(true);
  expect(overlay?.host.getAttribute('data-theme')).toBe('dark');
  overlay?.setView({ hidden: [] });
  overlay?.refresh();
  expect(a.hasAttribute('data-buildr-dimmed')).toBe(false);
  expect(shadow.querySelector('.moveUp')?.getAttribute('aria-label')).toBe('Up');
});
it('follows scroll and resize while preserving keyboard focus and hides toolbar during drag', () => {
  const { shadow, setTop, store } = setup();
  (shadow.querySelector('.moveUp') as HTMLButtonElement).focus();
  setTop(200);
  window.dispatchEvent(new Event('scroll'));
  overlay?.refresh();
  expect((shadow.querySelector('.toolbar') as HTMLElement).style.top).toBe('128px');
  expect((shadow.activeElement as HTMLElement)?.classList.contains('moveUp')).toBe(true);
  setTop(10);
  window.dispatchEvent(new Event('resize'));
  overlay?.refresh();
  expect((shadow.querySelector('.toolbar') as HTMLElement).style.top).toBe('70px');
  store.update({ drop: { kind: 'line', rect: { x: 0, y: 0, width: 100, height: 2 } } });
  overlay?.refresh();
  expect(shadow.querySelector('.toolbar')).toBeNull();
});

it('keeps alignment choices open across pointerup and refresh and hides immediately on handle drag', () => {
  const { shadow } = setup();
  (shadow.querySelector('.align') as HTMLButtonElement).click();
  window.dispatchEvent(new Event('pointerup'));
  overlay?.refresh();
  expect(shadow.querySelector('.align-menu')?.hasAttribute('hidden')).toBe(false);
  (shadow.querySelector('.drag') as HTMLElement).dispatchEvent(new Event('pointerdown'));
  overlay?.refresh();
  expect(shadow.querySelector('.toolbar')).toBeNull();
  window.dispatchEvent(new Event('pointercancel'));
  overlay?.refresh();
  expect(shadow.querySelector('.toolbar')).not.toBeNull();
});

it('uses the insert button centre for keyboard activation and limits insertion tab stops', () => {
  const { shadow, onInsert } = setup();
  const buttons = [...shadow.querySelectorAll<HTMLButtonElement>('.ins-btn')];
  expect(buttons).toHaveLength(3);
  expect(buttons.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
  vi.spyOn(buttons[0] as HTMLButtonElement, 'getBoundingClientRect').mockReturnValue({
    left: 40,
    top: 60,
    width: 28,
    height: 28,
  } as DOMRect);
  buttons[0]?.click();
  expect(onInsert).toHaveBeenLastCalledWith({
    target: { parentId: 'root', slot: 'children', index: 0 },
    point: { x: 54, y: 74 },
  });
});

it('keeps toolbar and insertion styles separate', () => {
  expect(OVERLAY_STYLE.match(/\.tool \{/g)).toHaveLength(1);
  expect(OVERLAY_STYLE).not.toMatch(/\.tool\s*\{[^}]*opacity:0/);
  expect(OVERLAY_STYLE).toContain('.insert-gap:hover .ins-btn');
  expect(OVERLAY_STYLE).toContain('.insert-gap.hot .ins-btn');
});

it('keeps the hovered insertion gap shown across a rebuild until the pointer leaves', () => {
  const { shadow } = setup();
  const gap = () => shadow.querySelectorAll<HTMLElement>('.insert-gap')[1] as HTMLElement;
  gap().dispatchEvent(new Event('pointerenter'));
  overlay?.refresh();
  expect(gap().classList.contains('hot')).toBe(true);
  expect(shadow.querySelectorAll('.insert-gap.hot')).toHaveLength(1);
  document.body.dispatchEvent(new Event('pointermove', { bubbles: true }));
  overlay?.refresh();
  expect(shadow.querySelectorAll('.insert-gap.hot')).toHaveLength(0);
});
