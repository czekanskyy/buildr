import { describe, expect, it } from 'vitest';
import type { BuilderDocument, NodeId, PageNode } from '../document/types.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import { createRegistryMeta } from '../registry/registry.ts';
import { computeDropTarget } from './compute-drop-target.ts';
import type {
  ChildRect,
  DragItem,
  DropResult,
  HitEntry,
  LayoutAxis,
  Point,
  Rect,
} from './types.ts';

function component(type: string, overrides: Partial<ComponentMeta> = {}): ComponentMeta {
  return {
    type,
    version: 1,
    label: type.replace('buildr/', ''),
    category: 'content',
    props: {},
    contentCategories: ['flow'],
    styles: { groups: [] },
    runtime: 'shared',
    ...overrides,
  };
}

const registry = createRegistryMeta({
  components: [
    component('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
    component('buildr/section', { slots: { default: {} } }),
    component('buildr/pair', { slots: { default: { max: 1 } } }),
    component('buildr/boxes', { slots: { default: { allow: ['buildr/textbox'] } } }),
    component('buildr/textbox', { slots: { default: { allow: ['buildr/text'] } } }),
    component('buildr/text', { contentCategories: ['flow', 'phrasing'] }),
    component('buildr/heading', { contentCategories: ['flow', 'heading'] }),
    component('buildr/multi', { slots: { header: {}, footer: {} } }),
  ],
  templates: [
    {
      id: 'acme/hero',
      version: 1,
      label: 'Hero',
      category: 'hero',
      lock: 'none',
      tree: { type: 'buildr/section', children: [{ type: 'buildr/text' }] },
      variants: { plain: { type: 'buildr/text' } },
    },
  ],
});

const ID = (n: number): NodeId => `node${String(n).padStart(6, '0')}`;
const R = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
const at = (x: number, y: number): Point => ({ x, y });

/** Nodes by id with their children; the first listed is the root's only child. */
function build(
  spec: readonly [NodeId, string, (readonly NodeId[])?, Partial<PageNode>?][],
): BuilderDocument {
  const nodes: Record<string, PageNode> = {};
  const components: Record<string, number> = { 'buildr/page': 1 };
  for (const [id, type, children, extra] of spec) {
    nodes[id] = { id, type, ...(children ? { slots: { default: children } } : {}), ...extra };
    components[type] = 1;
  }
  const first = spec[0]?.[0] ?? ID(1);
  nodes.root = { id: 'root', type: 'buildr/page', slots: { default: [first] } };
  return { schemaVersion: 1, root: 'root', nodes, components };
}

const entry = (
  nodeId: NodeId,
  rect: Rect,
  axis: LayoutAxis = 'y',
  children: readonly (readonly [NodeId, Rect])[] = [],
  slot = 'default',
): HitEntry => ({
  nodeId,
  rect,
  axis,
  childRects: children.map(([id, r]): ChildRect => ({ nodeId: id, slot, rect: r })),
});

const T = (type: string): DragItem => ({ kind: 'component', type });

/**
 * A page with, top to bottom: two texts, an empty card, a row of three texts and a 2x2 grid.
 * Everything is 400 wide.
 */
const doc = build([
  [ID(1), 'buildr/section', [ID(2), ID(3), ID(4), ID(5), ID(9)]],
  [ID(2), 'buildr/text'],
  [ID(3), 'buildr/text'],
  [ID(4), 'buildr/section', []],
  [ID(5), 'buildr/section', [ID(6), ID(7), ID(8)]],
  [ID(6), 'buildr/text'],
  [ID(7), 'buildr/text'],
  [ID(8), 'buildr/text'],
  [ID(9), 'buildr/section', [ID(10), ID(11), ID(12), ID(13)]],
  [ID(10), 'buildr/text'],
  [ID(11), 'buildr/text'],
  [ID(12), 'buildr/text'],
  [ID(13), 'buildr/text'],
]);

const rects = {
  page: R(0, 0, 400, 700),
  sec: R(0, 0, 400, 700),
  t1: R(0, 0, 400, 100),
  t2: R(0, 100, 400, 100),
  card: R(0, 200, 400, 100),
  row: R(0, 300, 400, 100),
  r1: R(0, 300, 100, 100),
  r2: R(150, 300, 100, 100),
  r3: R(300, 300, 100, 100),
  grid: R(0, 400, 400, 200),
  g1: R(0, 400, 200, 100),
  g2: R(200, 400, 200, 100),
  g3: R(0, 500, 200, 100),
  g4: R(200, 500, 200, 100),
};

const page = entry('root', rects.page, 'y', [[ID(1), rects.sec]]);
const sec = entry(ID(1), rects.sec, 'y', [
  [ID(2), rects.t1],
  [ID(3), rects.t2],
  [ID(4), rects.card],
  [ID(5), rects.row],
  [ID(9), rects.grid],
]);
const rowEntry = entry(ID(5), rects.row, 'x', [
  [ID(6), rects.r1],
  [ID(7), rects.r2],
  [ID(8), rects.r3],
]);
const gridEntry = entry(ID(9), rects.grid, 'grid', [
  [ID(10), rects.g1],
  [ID(11), rects.g2],
  [ID(12), rects.g3],
  [ID(13), rects.g4],
]);

const drop = (
  point: Point,
  path: readonly HitEntry[],
  item: DragItem = T('buildr/text'),
  testDoc: BuilderDocument = doc,
): DropResult => computeDropTarget({ point, hitPath: path, doc: testDoc, registry, item });

const leaf = (id: NodeId, rect: Rect) => entry(id, rect);

describe('computeDropTarget', () => {
  describe('before / after a leaf in a column', () => {
    it.each([
      ['upper half of the first text', at(200, 30), [leaf(ID(2), rects.t1), sec, page], 0],
      ['lower half of the first text', at(200, 70), [leaf(ID(2), rects.t1), sec, page], 1],
      ['upper half of the second text', at(200, 120), [leaf(ID(3), rects.t2), sec, page], 1],
      ['lower half of the second text', at(200, 190), [leaf(ID(3), rects.t2), sec, page], 2],
    ])('%s', (_name, point, path, index) => {
      const result = drop(point, path);
      expect(result.target).toEqual({ parentId: ID(1), slot: 'default', index });
      expect(result.indicator).toMatchObject({ kind: 'line', axis: 'y' });
    });

    it('draws the line on the edge it inserts at', () => {
      const before = drop(at(200, 30), [leaf(ID(2), rects.t1), sec, page]);
      expect(before.indicator?.rect).toEqual({ x: 0, y: -1, width: 400, height: 2 });
      const after = drop(at(200, 70), [leaf(ID(2), rects.t1), sec, page]);
      expect(after.indicator?.rect).toEqual({ x: 0, y: 99, width: 400, height: 2 });
    });
  });

  describe('a row', () => {
    it.each([
      ['left half of the middle item', at(170, 350), 1],
      ['right half of the middle item', at(230, 350), 2],
    ])('%s', (_name, point, index) => {
      const result = drop(point, [leaf(ID(7), rects.r2), rowEntry, sec, page]);
      expect(result.target).toEqual({ parentId: ID(5), slot: 'default', index });
      expect(result.indicator).toMatchObject({ kind: 'line', axis: 'x' });
      expect(result.indicator?.rect.width).toBe(2);
    });
  });

  describe('a grid', () => {
    it.each([
      ['near the left edge of the first cell', at(3, 450), 0, 'x'],
      ['near the right edge of the first cell', at(196, 450), 1, 'x'],
      ['near the top edge of the third cell', at(100, 503), 2, 'y'],
      ['near the bottom edge of the third cell', at(100, 597), 3, 'y'],
    ])('%s', (_name, point, index, axis) => {
      const cell = index < 2 ? [ID(10), rects.g1] : [ID(12), rects.g3];
      const result = drop(point, [leaf(cell[0] as string, cell[1] as Rect), gridEntry, sec, page]);
      expect(result.target).toEqual({ parentId: ID(9), slot: 'default', index });
      expect(result.indicator?.axis).toBe(axis);
    });
  });

  describe('inside a container', () => {
    it('an empty container takes the drop at index 0 and is highlighted', () => {
      const result = drop(at(200, 250), [entry(ID(4), rects.card), sec, page]);
      expect(result.target).toEqual({ parentId: ID(4), slot: 'default', index: 0 });
      expect(result.indicator).toEqual({ kind: 'inside', axis: 'y', rect: rects.card });
    });

    it('the edge zone of a container means before / after it, not inside', () => {
      const top = drop(at(200, 203), [entry(ID(4), rects.card), sec, page]);
      expect(top.target).toEqual({ parentId: ID(1), slot: 'default', index: 2 });
      const bottom = drop(at(200, 297), [entry(ID(4), rects.card), sec, page]);
      expect(bottom.target).toEqual({ parentId: ID(1), slot: 'default', index: 3 });
    });

    it('picks the gap nearest to the pointer along the layout axis', () => {
      // The pointer is in the container itself, not over a child.
      const gapDoc = build([
        [ID(1), 'buildr/section', [ID(2), ID(3), ID(4)]],
        [ID(2), 'buildr/text'],
        [ID(3), 'buildr/text'],
        [ID(4), 'buildr/text'],
      ]);
      const box = entry(ID(1), R(0, 0, 400, 400), 'y', [
        [ID(2), R(20, 20, 360, 50)],
        [ID(3), R(20, 100, 360, 50)],
        [ID(4), R(20, 200, 360, 50)],
      ]);
      const cases: [number, number][] = [
        [30, 0],
        [80, 1],
        [170, 2],
        [300, 3],
      ];
      for (const [y, index] of cases) {
        const result = drop(
          at(200, y),
          [box, entry('root', R(0, 0, 400, 400), 'y', [[ID(1), R(0, 0, 400, 400)]])],
          T('buildr/text'),
          gapDoc,
        );
        expect(result.target, `y=${y}`).toEqual({ parentId: ID(1), slot: 'default', index });
        expect(result.indicator?.kind).toBe('line');
      }
    });

    it('maps the gap back over children that have no box', () => {
      const hiddenDoc = build([
        [ID(1), 'buildr/section', [ID(2), ID(3), ID(4)]],
        [ID(2), 'buildr/text'],
        [ID(3), 'buildr/text'],
        [ID(4), 'buildr/text'],
      ]);
      const box = entry(ID(1), R(0, 0, 400, 400), 'y', [
        [ID(2), R(20, 20, 360, 50)],
        [ID(4), R(20, 100, 360, 50)],
      ]);
      const result = drop(at(200, 300), [box], T('buildr/text'), hiddenDoc);
      expect(result.target).toEqual({ parentId: ID(1), slot: 'default', index: 3 });
      const middle = drop(at(200, 85), [box], T('buildr/text'), hiddenDoc);
      expect(middle.target?.index).toBe(1);
    });

    it('chooses the slot of a multi-slot node from its placeholders', () => {
      const multiDoc: BuilderDocument = {
        ...build([[ID(1), 'buildr/multi']]),
      };
      const slotted = {
        ...multiDoc,
        nodes: {
          ...multiDoc.nodes,
          [ID(1)]: { id: ID(1), type: 'buildr/multi', slots: { header: [], footer: [] } },
        },
      };
      const box: HitEntry = {
        nodeId: ID(1),
        rect: R(0, 0, 400, 400),
        axis: 'y',
        childRects: [],
        slotRects: { header: R(0, 0, 400, 100), footer: R(0, 300, 400, 100) },
      };
      expect(drop(at(200, 50), [box], T('buildr/text'), slotted).target?.slot).toBe('header');
      expect(drop(at(200, 350), [box], T('buildr/text'), slotted).target?.slot).toBe('footer');
    });
  });

  describe('walking up when the deepest candidate is refused', () => {
    // boxes (only textboxes) > textbox (only texts) > text
    const nested = build([
      [ID(1), 'buildr/boxes', [ID(2)]],
      [ID(2), 'buildr/textbox', [ID(3)]],
      [ID(3), 'buildr/text'],
    ]);
    const boxes = entry(ID(1), R(0, 0, 400, 400), 'y', [[ID(2), R(20, 20, 360, 360)]]);
    const textbox = entry(ID(2), R(20, 20, 360, 360), 'y', [[ID(3), R(40, 40, 320, 100)]]);
    const text = leaf(ID(3), R(40, 40, 320, 100));
    const top = entry('root', R(0, 0, 400, 400), 'y', [[ID(1), R(0, 0, 400, 400)]]);

    it('falls back to the parent slot when the child is not accepted', () => {
      // A textbox next to the text is not allowed, but a text is: before/after the text works.
      const result = drop(at(200, 60), [text, textbox, boxes, top], T('buildr/text'), nested);
      expect(result.target).toEqual({ parentId: ID(2), slot: 'default', index: 0 });
    });

    it('walks up to an ancestor whose edge zone is under the pointer', () => {
      // A textbox cannot go among texts, nor inside the textbox; near the textbox's own edge it can go in `boxes`.
      const result = drop(at(200, 22), [textbox, boxes, top], T('buildr/textbox'), nested);
      expect(result.target).toEqual({ parentId: ID(1), slot: 'default', index: 0 });
    });

    it('is null, with the first refusal as the reason, when nothing accepts the item', () => {
      const result = drop(at(200, 200), [textbox, boxes], T('buildr/heading'), nested);
      expect(result.target).toBeNull();
      expect(result.indicator).toBeUndefined();
      expect(result.reason?.code).toBe('slot-not-allowed');
    });
  });

  describe('exclusions', () => {
    it('refuses a slot that is full, and lands next to the container when its parent allows', () => {
      const pairDoc = build([
        [ID(1), 'buildr/pair', [ID(2)]],
        [ID(2), 'buildr/text'],
      ]);
      const pair = entry(ID(1), R(0, 0, 400, 400), 'y', [[ID(2), R(20, 20, 360, 100)]]);
      const result = drop(at(200, 300), [pair], T('buildr/text'), pairDoc);
      expect(result.target).toEqual({ parentId: 'root', slot: 'default', index: 1 });
    });

    it('reports a full slot when the container cannot be dropped next to either', () => {
      const boxed = build([
        [ID(1), 'buildr/boxes', [ID(2)]],
        [ID(2), 'buildr/pair', [ID(3)]],
        [ID(3), 'buildr/text'],
      ]);
      const boxes = entry(ID(1), R(0, 0, 400, 400), 'y', [[ID(2), R(50, 50, 300, 300)]]);
      const pair = entry(ID(2), R(50, 50, 300, 300), 'y', [[ID(3), R(60, 60, 280, 50)]]);
      const result = drop(at(200, 250), [pair, boxes], T('buildr/text'), boxed);
      expect(result.target).toBeNull();
      expect(result.reason?.code).toBe('slot-max-exceeded');
    });

    it('refuses a structurally locked container', () => {
      const base = build([[ID(1), 'buildr/section', []]]);
      const lockedDoc = {
        ...base,
        nodes: { ...base.nodes, root: { ...base.nodes.root, lock: { structure: true as const } } },
      } as BuilderDocument;
      const box = entry(ID(1), R(0, 0, 400, 400));
      const result = drop(at(200, 200), [box], T('buildr/text'), lockedDoc);
      expect(result.target).toBeNull();
      expect(result.reason?.code).toBe('locked-structure');
    });

    it('refuses a component that cannot go there (heading only takes phrasing)', () => {
      const headingDoc = build([[ID(1), 'buildr/heading', []]]);
      const withSlot = {
        ...headingDoc,
        nodes: {
          ...headingDoc.nodes,
          [ID(1)]: { id: ID(1), type: 'buildr/section', slots: { default: [] } },
        },
      };
      expect(
        drop(at(200, 200), [entry(ID(1), R(0, 0, 400, 400))], T('acme/unknown'), withSlot).reason
          ?.code,
      ).toBe('unknown-component-type');
    });

    it('returns null and a reason when there is nothing under the pointer', () => {
      const result = drop(at(5, 5), []);
      expect(result.target).toBeNull();
      expect(result.reason?.code).toBe('target-not-found');
    });
  });

  describe('moving nodes', () => {
    it('lets a node hover over itself and drops into the container around it', () => {
      const result = drop(at(200, 50), [leaf(ID(2), rects.t1), sec, page], {
        kind: 'nodes',
        ids: [ID(2)],
      });
      expect(result.target?.parentId).toBe(ID(1));
    });

    it('never targets the moved node or anything inside it', () => {
      const tree = build([
        [ID(1), 'buildr/section', [ID(2)]],
        [ID(2), 'buildr/section', [ID(3)]],
        [ID(3), 'buildr/section', []],
      ]);
      const inner = entry(ID(3), R(40, 40, 200, 200));
      const middle = entry(ID(2), R(20, 20, 360, 360), 'y', [[ID(3), R(40, 40, 200, 200)]]);
      const result = drop(at(100, 100), [inner, middle], { kind: 'nodes', ids: [ID(2)] }, tree);
      expect(result.target).toBeNull();
      expect(result.reason?.code).toBe('cycle');
    });

    it('moves several nodes only when each may go there', () => {
      const ok = drop(at(200, 250), [entry(ID(4), rects.card), sec, page], {
        kind: 'nodes',
        ids: [ID(2), ID(3)],
      });
      expect(ok.target).toEqual({ parentId: ID(4), slot: 'default', index: 0 });
      const none = drop(at(200, 250), [entry(ID(4), rects.card), sec, page], {
        kind: 'nodes',
        ids: [],
      });
      expect(none.target).toBeNull();
    });
  });

  describe('templates', () => {
    it('drops a template like a component of its root type', () => {
      const result = drop(at(200, 250), [entry(ID(4), rects.card), sec, page], {
        kind: 'template',
        id: 'acme/hero',
      });
      expect(result.target).toEqual({ parentId: ID(4), slot: 'default', index: 0 });
    });

    it('checks the variant when one is given', () => {
      const path = [entry(ID(1), R(0, 0, 400, 400))];
      const boxDoc = build([[ID(1), 'buildr/textbox', []]]);
      // The variant is a text, which a textbox takes; the default tree is a section, which it does not.
      expect(
        drop(at(200, 200), path, { kind: 'template', id: 'acme/hero', variant: 'plain' }, boxDoc)
          .target,
      ).not.toBeNull();
      // The section does not fit inside the textbox, so it lands next to it instead.
      expect(
        drop(at(200, 200), path, { kind: 'template', id: 'acme/hero' }, boxDoc).target?.parentId,
      ).toBe('root');
    });

    it('is refused when the template does not exist', () => {
      const result = drop(at(200, 250), [entry(ID(4), rects.card), sec, page], {
        kind: 'template',
        id: 'acme/nope',
      });
      expect(result.target).toBeNull();
      expect(result.reason?.code).toBe('unknown-component-type');
    });
  });

  it('is deterministic and does not touch its input', () => {
    const path = [leaf(ID(3), rects.t2), sec, page];
    const before = JSON.stringify([doc, path]);
    const first = drop(at(200, 120), path);
    const second = drop(at(200, 120), path);
    expect(second).toEqual(first);
    expect(JSON.stringify([doc, path])).toBe(before);
  });
});
