// @vitest-environment jsdom
import { s } from '@buildr/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc, node, registry } from '../../render/render.test-kit.tsx';
import { createOverlay } from '../overlay/overlay.ts';
import { createCanvasStore } from '../store.ts';
import type { CanvasTransport } from '../types.ts';
import { createDndController } from './controller.ts';
import { buildHitPath, layoutAxisOf } from './hit-path.ts';

const sent: { type: string; payload: Record<string, unknown> }[] = [];
const transport = {
  send: (type: string, payload: Record<string, unknown>) => {
    sent.push({ type, payload });
    return true;
  },
} as unknown as CanvasTransport;
const of = (type: string) => sent.filter((m) => m.type === type).map((m) => m.payload);

const rects: Record<string, [number, number, number, number]> = {
  root: [0, 0, 400, 200],
  node000001: [0, 0, 400, 100],
  node000002: [0, 0, 200, 100],
  node000003: [200, 0, 200, 100],
};

const store = createCanvasStore();
const $ = (id: string) => document.querySelector(`[data-bid="${id}"]`) as HTMLElement;

beforeEach(() => {
  sent.length = 0;
  document.body.innerHTML = `
    <div data-bid="root"><section data-bid="node000001" style="display:flex;flex-direction:row">
      <p data-bid="node000002">A</p><p data-bid="node000003">B</p></section></div>`;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const [x, y, width, height] = rects[this.getAttribute('data-bid') ?? ''] ?? [0, 0, 0, 0];
    return {
      x,
      y,
      width,
      height,
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
    } as DOMRect;
  });
  document.elementsFromPoint = (x: number, y: number) =>
    ['node000003', 'node000002', 'node000001', 'root']
      .filter((id) => {
        const [rx, ry, w, h] = rects[id] as [number, number, number, number];
        return x >= rx && x <= rx + w && y >= ry && y <= ry + h;
      })
      .map($)
      .filter((el) => el !== null);
  store.setDocument(
    doc(
      [
        node(1, 'buildr/section', {}, {}),
        node(2, 'buildr/text', { text: s('A') }),
        node(3, 'buildr/text', { text: s('B') }),
      ],
      { node000001: ['node000002', 'node000003'] },
    ),
    1,
  );
  store.update({ mode: 'edit', selection: [], hover: null, drop: null });
});

afterEach(() => vi.restoreAllMocks());

const controller = () =>
  createDndController({
    document,
    store,
    transport: () => transport,
    registry: () => registry.meta,
  });

describe('buildHitPath', () => {
  it('lists the nodes under the point from the deepest to the root, with axis and child boxes', () => {
    const path = buildHitPath(document, { x: 300, y: 50 }, store);
    expect(path.map((e) => e.nodeId)).toEqual(['node000003', 'node000001', 'root']);
    const section = path[1];
    expect(section?.axis).toBe('x');
    expect(section?.rect).toEqual({ x: 0, y: 0, width: 400, height: 100 });
    expect(section?.childRects).toEqual([
      { nodeId: 'node000002', slot: 'default', rect: { x: 0, y: 0, width: 200, height: 100 } },
      { nodeId: 'node000003', slot: 'default', rect: { x: 200, y: 0, width: 200, height: 100 } },
    ]);
    expect(path[2]?.axis).toBe('y');
  });

  it('is empty where there is no node', () => {
    expect(buildHitPath(document, { x: 900, y: 900 }, store)).toEqual([]);
  });

  it('reads the layout axis from the computed style', () => {
    expect(layoutAxisOf({ display: 'flex', flexDirection: 'column' })).toBe('y');
    expect(layoutAxisOf({ display: 'inline-flex', flexDirection: 'row-reverse' })).toBe('x');
    expect(layoutAxisOf({ display: 'grid', flexDirection: 'row' })).toBe('grid');
    expect(layoutAxisOf({ display: 'block', flexDirection: 'row' })).toBe('y');
  });

  it('reports the box of an empty slot placeholder', () => {
    document.body.innerHTML = `<div data-bid="root"><div data-buildr-placeholder="empty-slot" data-buildr-slot="default"></div></div>`;
    const path = buildHitPath(document, { x: 1, y: 1 }, store);
    expect(path[0]?.nodeId).toBe('root');
    expect(path[0]?.slotRects).toBeDefined();
  });
});

describe('items dragged in from the editor', () => {
  it('finds the target, draws the indicator and answers once per change', () => {
    const dnd = controller();
    const item = { kind: 'component', type: 'buildr/text' } as const;
    dnd.over({ x: 390, y: 50 }, item);
    dnd.over({ x: 390, y: 50 }, item);
    expect(of('dnd:target')).toEqual([
      { target: { parentId: 'node000001', slot: 'default', index: 2 } },
    ]);
    expect(store.getState().drop?.kind).toBe('line');

    dnd.over({ x: 290, y: 50 }, item);
    expect(of('dnd:target')).toHaveLength(2);
    expect(of('dnd:target')[1]).toEqual({
      target: { parentId: 'node000001', slot: 'default', index: 1 },
    });
  });

  it('refuses with the reason and shows it', () => {
    const dnd = controller();
    dnd.over({ x: 390, y: 50 }, { kind: 'component', type: 'buildr/page' });
    const [message] = of('dnd:target');
    const why = (message as { reason?: { message: string } } | undefined)?.reason?.message;
    expect(message?.['target']).toBeNull();
    expect(why).toBeTruthy();
    expect(store.getState().drop?.kind).toBe('forbidden');
    expect(store.getState().drop?.message).toBe(why);
  });

  it('clears the indicator when the item leaves', () => {
    const dnd = controller();
    dnd.over({ x: 390, y: 50 }, { kind: 'component', type: 'buildr/text' });
    dnd.leave();
    expect(store.getState().drop).toBeNull();
  });

  it('answers nothing in interact mode', () => {
    store.update({ mode: 'interact' });
    controller().over({ x: 390, y: 50 }, { kind: 'component', type: 'buildr/text' });
    expect(sent).toEqual([]);
  });

  it('reports no target away from every node', () => {
    controller().over({ x: 900, y: 900 }, { kind: 'component', type: 'buildr/text' });
    expect(of('dnd:target')).toEqual([{ target: null }]);
    expect(store.getState().drop).toBeNull();
  });
});

describe('moving a node with the handle', () => {
  const down = (dnd: ReturnType<typeof controller>, x: number, y: number) =>
    dnd.beginMove({ preventDefault() {}, clientX: x, clientY: y, pointerId: 1 } as PointerEvent);
  const fire = (type: string, x: number, y: number) =>
    document.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));

  it('sends intent:move with the target where the pointer is released', () => {
    store.update({ selection: ['node000003'] });
    const dnd = controller();
    down(dnd, 100, 50);
    fire('pointermove', 10, 50);
    expect(store.getState().drop?.kind).toBe('line');
    fire('pointerup', 10, 50);
    expect(of('intent:move')).toEqual([
      { ids: ['node000003'], target: { parentId: 'node000001', slot: 'default', index: 0 } },
    ]);
    expect(store.getState().drop).toBeNull();
    fire('pointerup', 10, 50);
    expect(of('intent:move')).toHaveLength(1);
  });

  it('sends nothing when the drop is refused, or cancelled with Escape', () => {
    store.update({ selection: ['node000002'] });
    const dnd = controller();
    down(dnd, 100, 50);
    fire('pointermove', 900, 900);
    fire('pointerup', 900, 900);
    expect(of('intent:move')).toEqual([]);

    down(dnd, 100, 50);
    fire('pointermove', 390, 50);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fire('pointerup', 390, 50);
    expect(of('intent:move')).toEqual([]);
    expect(store.getState().drop).toBeNull();
  });

  it('does not move the root', () => {
    store.update({ selection: ['root'] });
    const dnd = controller();
    down(dnd, 100, 50);
    fire('pointerup', 390, 50);
    expect(of('intent:move')).toEqual([]);
  });

  it('does not start in interact mode', () => {
    store.update({ selection: ['node000002'], mode: 'interact' });
    const dnd = controller();
    down(dnd, 100, 50);
    fire('pointerup', 390, 50);
    expect(of('intent:move')).toEqual([]);
  });
});

describe('overlay: drag handle and indicator', () => {
  it('offers a handle on a selected node other than the root, and draws the indicator', () => {
    const onHandleDown = vi.fn();
    store.update({ selection: ['node000002'] });
    const overlay = createOverlay({ document, store, onHandleDown });
    overlay.refresh();
    const handle = overlay.host.shadowRoot?.querySelector('[data-buildr-handle]') as HTMLElement;
    expect(handle).not.toBeNull();
    handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(onHandleDown).toHaveBeenCalledTimes(1);

    store.update({
      drop: { kind: 'forbidden', rect: { x: 1, y: 2, width: 30, height: 40 }, message: 'not here' },
    });
    overlay.refresh();
    const drop = overlay.host.shadowRoot?.querySelector(
      '[data-buildr-drop="forbidden"]',
    ) as HTMLElement;
    expect(drop.style.left).toBe('1px');
    expect(drop.textContent).toBe('not here');

    store.update({ selection: ['root'], drop: null });
    overlay.refresh();
    expect(overlay.host.shadowRoot?.querySelector('[data-buildr-handle]')).toBeNull();
    overlay.destroy();
  });
});
