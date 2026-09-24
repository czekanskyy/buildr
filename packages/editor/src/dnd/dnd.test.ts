import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  type DragItem,
} from '@buildr/core';
import { describe, expect, it, vi } from 'vitest';
import { flattenTree } from '../panels/layers/flatten.ts';
import { createEditorStore } from '../store/index.ts';
import { moveDestinations } from './destinations.ts';
import {
  type CanvasSurface,
  createDragEngine,
  DRAG_THRESHOLD,
  type DragHost,
  type TreeSurface,
} from './engine.ts';
import { autoscrollDelta, toCanvasPoint } from './geometry.ts';
import { treeDropTarget } from './tree-target.ts';

const base: ComponentMeta = {
  type: 'buildr/leaf',
  version: 1,
  label: 'Leaf',
  category: 'content',
  props: {},
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
};
const box: ComponentMeta = {
  ...base,
  type: 'buildr/box',
  label: 'Box',
  slots: { default: {} },
};
const page: ComponentMeta = {
  ...box,
  type: 'buildr/page',
  label: 'Page',
  capabilities: { root: true },
};
const registry = createRegistryMeta({ components: [page, box, base] });

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['boxAAAAAA1', 'leafBBBBB1'] } },
    boxAAAAAA1: { id: 'boxAAAAAA1', type: 'buildr/box', slots: { default: ['leafCCCCC1'] } },
    leafBBBBB1: { id: 'leafBBBBB1', type: 'buildr/leaf' },
    leafCCCCC1: { id: 'leafCCCCC1', type: 'buildr/leaf' },
  },
  components: {},
});

const newStore = (doc = fixture()) =>
  createEditorStore({
    doc,
    registry,
    generateId: createSeededIdGenerator(7),
    validationDelayMs: null,
  });

const ROW = 28;
const all = (doc: BuilderDocument) => new Set(Object.keys(doc.nodes));

describe('toCanvasPoint', () => {
  it('subtracts the frame offset and divides by the zoom', () => {
    const frame = { left: 100, top: 50, width: 640, height: 400 };
    expect(toCanvasPoint({ x: 100, y: 50 }, frame)).toEqual({ x: 0, y: 0 });
    expect(toCanvasPoint({ x: 420, y: 250 }, frame, 0.5)).toEqual({ x: 640, y: 400 });
    expect(toCanvasPoint({ x: 150, y: 90 }, frame, 2)).toEqual({ x: 25, y: 20 });
  });

  it('gives nothing for a frame that is not laid out', () => {
    const frame = { left: 0, top: 0, width: 0, height: 0 };
    expect(toCanvasPoint({ x: 1, y: 1 }, frame, 0)).toBeUndefined();
    expect(toCanvasPoint({ x: 1, y: 1 }, frame, Number.NaN)).toBeUndefined();
  });
});

describe('autoscrollDelta', () => {
  const region = { left: 0, top: 100, width: 200, height: 300 };
  it('is zero in the middle and grows towards the edges', () => {
    expect(autoscrollDelta(region, 250)).toBe(0);
    const near = autoscrollDelta(region, 130);
    const at = autoscrollDelta(region, 100);
    expect(near).toBeLessThan(0);
    expect(at).toBeLessThan(near);
    expect(autoscrollDelta(region, 380)).toBeGreaterThan(0);
  });
  it('keeps scrolling at full speed past the edge', () => {
    expect(autoscrollDelta(region, 20)).toBe(-24);
    expect(autoscrollDelta(region, 900)).toBe(24);
  });
});

describe('treeDropTarget', () => {
  const rows = (doc = fixture()) => flattenTree(doc, all(doc));
  // Rows: 0 root, 1 box, 2 leafC (in box), 3 leafB.
  const at = (item: DragItem, row: number, within: number, doc = fixture()) =>
    treeDropTarget({
      doc,
      registry,
      rows: rows(doc),
      item,
      y: row * ROW + within * ROW,
      rowHeight: ROW,
    });

  it('drops before, inside and after the row under the pointer', () => {
    const item: DragItem = { kind: 'component', type: 'buildr/leaf' };
    expect(at(item, 3, 0.1)?.target).toEqual({ parentId: 'root', slot: 'default', index: 1 });
    expect(at(item, 3, 0.9)?.target).toEqual({ parentId: 'root', slot: 'default', index: 2 });
    expect(at(item, 1, 0.5)?.target).toEqual({ parentId: 'boxAAAAAA1', slot: 'default', index: 1 });
  });

  it('falls back to the parent when a leaf cannot hold the item', () => {
    const result = at({ kind: 'component', type: 'buildr/leaf' }, 3, 0.5);
    expect(result?.target).toEqual({ parentId: 'root', slot: 'default', index: 2 });
  });

  it('only ever drops inside the root row', () => {
    const result = at({ kind: 'component', type: 'buildr/leaf' }, 0, 0.05);
    expect(result?.position).toBe('inside');
    expect(result?.target?.parentId).toBe('root');
  });

  it('clamps a pointer past the last row', () => {
    const result = treeDropTarget({
      doc: fixture(),
      registry,
      rows: rows(),
      item: { kind: 'component', type: 'buildr/leaf' },
      y: 10_000,
      rowHeight: ROW,
    });
    expect(result?.rowIndex).toBe(3);
  });

  it('refuses moving a node into itself and says why', () => {
    const result = at({ kind: 'nodes', ids: ['boxAAAAAA1'] }, 2, 0.5);
    // Inside the leaf is impossible; after it and after the box (its own place) are not offered.
    expect(result?.target).toBeNull();
    expect(result?.reason).toBeDefined();
  });

  it('refuses an unknown palette item', () => {
    expect(at({ kind: 'component', type: 'nope/none' }, 3, 0.5)?.target).toBeNull();
  });

  it('gives nothing for an empty list', () => {
    expect(
      treeDropTarget({
        doc: fixture(),
        registry,
        rows: [],
        item: { kind: 'nodes', ids: ['leafBBBBB1'] },
        y: 0,
        rowHeight: ROW,
      }),
    ).toBeUndefined();
  });
});

describe('moveDestinations', () => {
  it('lists the slots the rules accept, never inside the moved node', () => {
    const doc = fixture();
    const list = moveDestinations(doc, registry, ['boxAAAAAA1']);
    expect(list.map((d) => d.parentId)).toEqual(['root']);
    const leaf = moveDestinations(doc, registry, ['leafCCCCC1']).map((d) => d.parentId);
    expect(leaf).toEqual(['root', 'boxAAAAAA1']);
  });

  it('gives nothing for the root or an unknown id', () => {
    expect(moveDestinations(fixture(), registry, ['root', 'zzzzzzzzzz'])).toEqual([]);
  });
});

describe('createDragEngine', () => {
  function setup(options: { canvasScale?: number } = {}) {
    const store = newStore();
    const host: DragHost = { dndOver: vi.fn(), dndLeave: vi.fn() };
    const frames: (() => void)[] = [];
    const canvas: CanvasSurface = {
      frame: { left: 300, top: 0, width: 600, height: 600 },
      scale: options.canvasScale ?? 1,
    };
    const rows = flattenTree(store.getState().doc, all(store.getState().doc));
    const tree: TreeSurface = {
      viewport: { left: 0, top: 0, width: 280, height: 400 },
      scrollTop: 0,
      rows,
      rowHeight: ROW,
    };
    const engine = createDragEngine({
      store,
      host: () => host,
      surfaces: { canvas: () => canvas, tree: () => tree },
      raf: (cb) => frames.push(cb),
      caf: () => undefined,
    });
    const flush = () => {
      const pending = frames.splice(0);
      for (const cb of pending) cb();
    };
    return { store, host, engine, flush };
  }
  const leaf: DragItem = { kind: 'component', type: 'buildr/leaf' };

  it('stays a click until the pointer moves past the threshold', () => {
    const { engine } = setup();
    engine.press(leaf, 'Leaf', { x: 10, y: 10 });
    engine.move({ x: 10 + DRAG_THRESHOLD - 1, y: 10 });
    expect(engine.state.getState().phase).toBe('pending');
    expect(engine.release()).toBe(false);
    expect(engine.state.getState().phase).toBe('idle');
    engine.press(leaf, 'Leaf', { x: 10, y: 10 });
    engine.move({ x: 10 + DRAG_THRESHOLD, y: 10 });
    expect(engine.state.getState().phase).toBe('dragging');
  });

  it('forwards the pointer to the canvas once per frame, translated for offset and zoom', () => {
    const { engine, host, flush } = setup({ canvasScale: 0.5 });
    engine.press(leaf, 'Leaf', { x: 10, y: 10 });
    engine.move({ x: 320, y: 40 });
    engine.move({ x: 400, y: 100 });
    engine.move({ x: 500, y: 200 });
    expect(host.dndOver).not.toHaveBeenCalled();
    flush();
    expect(host.dndOver).toHaveBeenCalledTimes(1);
    expect(host.dndOver).toHaveBeenCalledWith({ x: 400, y: 400 }, leaf);
    expect(engine.state.getState().over).toBe('canvas');
  });

  it('drops what the canvas chose and selects the new node', () => {
    const { engine, store } = setup();
    engine.press(leaf, 'Leaf', { x: 10, y: 10 });
    engine.move({ x: 400, y: 100 });
    engine.receiveTarget({ parentId: 'root', slot: 'default', index: 1 });
    expect(engine.release()).toBe(true);
    const children = store.getState().doc.nodes['root']?.slots?.['default'] ?? [];
    expect(children).toHaveLength(3);
    expect(store.getState().selectedIds).toEqual([children[1]]);
    expect(engine.state.getState().phase).toBe('idle');
  });

  it('tells the canvas the drag is over, also when it is cancelled', () => {
    const { engine, host, flush } = setup();
    engine.press(leaf, 'Leaf', { x: 10, y: 10 });
    engine.move({ x: 400, y: 100 });
    flush();
    engine.cancel();
    expect(host.dndLeave).toHaveBeenCalledTimes(1);
    expect(engine.state.getState().phase).toBe('idle');
  });

  it('does not drop where the canvas refused', () => {
    const { engine, store } = setup();
    engine.press(leaf, 'Leaf', { x: 10, y: 10 });
    engine.move({ x: 400, y: 100 });
    engine.receiveTarget(null, { code: 'x' as never, message: 'no' });
    expect(engine.release()).toBe(false);
    expect(store.getState().doc.nodes['root']?.slots?.['default']).toHaveLength(2);
  });

  it('ignores a target that arrives after the drag ended', () => {
    const { engine } = setup();
    engine.receiveTarget({ parentId: 'root', slot: 'default', index: 0 });
    expect(engine.state.getState().target).toBeNull();
  });

  it('moves nodes within the tree', () => {
    const { engine, store } = setup();
    engine.press({ kind: 'nodes', ids: ['leafBBBBB1'] }, 'Leaf', { x: 20, y: 3 * ROW + 14 });
    // Over the top edge of the first box row: before it.
    engine.move({ x: 20, y: 1 * ROW + 2 });
    expect(engine.state.getState().over).toBe('tree');
    expect(engine.state.getState().target).toEqual({
      parentId: 'root',
      slot: 'default',
      index: 0,
    });
    expect(engine.release()).toBe(true);
    expect(store.getState().doc.nodes['root']?.slots?.['default']).toEqual([
      'leafBBBBB1',
      'boxAAAAAA1',
    ]);
  });

  it('refuses a drop into the node itself and keeps the document', () => {
    const { engine, store } = setup();
    const before = store.getState().doc;
    engine.press({ kind: 'nodes', ids: ['boxAAAAAA1'] }, 'Box', { x: 20, y: 1 * ROW + 14 });
    engine.move({ x: 20, y: 2 * ROW + 14 });
    expect(engine.state.getState().target).toBeNull();
    expect(engine.state.getState().reason).not.toBeNull();
    expect(engine.release()).toBe(false);
    expect(store.getState().doc).toBe(before);
  });

  it('never drops into a read-only document', () => {
    const { engine, store } = setup();
    store.setReadOnly(true);
    const before = store.getState().doc;
    engine.press({ kind: 'nodes', ids: ['leafBBBBB1'] }, 'Leaf', { x: 20, y: 3 * ROW + 14 });
    engine.move({ x: 20, y: 1 * ROW + 2 });
    expect(engine.release()).toBe(false);
    expect(store.getState().doc).toBe(before);
    expect(engine.state.getState().error).toBe('readOnly');
  });

  it('moves nodes by a direct drop (the Move to dialog)', () => {
    const { engine, store } = setup();
    const result = engine.drop(
      { kind: 'nodes', ids: ['leafBBBBB1'] },
      { parentId: 'boxAAAAAA1', slot: 'default', index: 1 },
    );
    expect(result.ok).toBe(true);
    expect(store.getState().doc.nodes['boxAAAAAA1']?.slots?.['default']).toEqual([
      'leafCCCCC1',
      'leafBBBBB1',
    ]);
  });

  it('leaves the canvas when the pointer goes to the tree', () => {
    const { engine, host, flush } = setup();
    engine.press(leaf, 'Leaf', { x: 10, y: 10 });
    engine.move({ x: 400, y: 100 });
    flush();
    engine.move({ x: 20, y: 3 * ROW + 14 });
    expect(host.dndLeave).toHaveBeenCalledTimes(1);
    expect(engine.state.getState().over).toBe('tree');
  });
});

describe('performance', () => {
  it('finds a drop target in a 1000-node tree well within a frame', () => {
    const nodes: Record<string, BuilderDocument['nodes'][string]> = {};
    const ids: string[] = [];
    for (let i = 0; i < 999; i++) {
      const id = `n${String(i).padStart(9, '0')}`;
      ids.push(id);
      nodes[id] = { id, type: 'buildr/leaf' };
    }
    nodes['root'] = { id: 'root', type: 'buildr/page', slots: { default: ids } };
    const doc: BuilderDocument = { schemaVersion: 1, root: 'root', nodes, components: {} };
    const rows = flattenTree(doc, new Set(['root']));
    const run = () =>
      treeDropTarget({
        doc,
        registry,
        rows,
        item: { kind: 'nodes', ids: [ids[10] as string] },
        y: 500 * ROW + 20,
        rowHeight: ROW,
      });
    run();
    const start = performance.now();
    for (let i = 0; i < 20; i++) run();
    const each = (performance.now() - start) / 20;
    // A frame is 16 ms; the budget leaves room for slow CI.
    expect(each).toBeLessThan(12);
  });
});
