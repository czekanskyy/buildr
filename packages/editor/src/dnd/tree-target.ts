import {
  type BuilderDocument,
  canInsert,
  createIndex,
  type DragItem,
  type DropTarget,
  type NodeId,
  type Reason,
  type RegistryMeta,
} from '@buildr/core';
import type { LayerRow } from '../panels/layers/flatten.ts';
import { moveVerdict } from './check.ts';
import { fragmentFor } from './fragment.ts';

export type TreePosition = 'before' | 'inside' | 'after';

export interface TreeDropResult {
  readonly target: DropTarget | null;
  /** The row the indicator is drawn at and on which side of it (or over it, for "inside"). */
  readonly rowIndex: number;
  readonly position: TreePosition;
  /** Why nothing accepts the drop, from the rule that refused the spot nearest the pointer. */
  readonly reason?: Reason | undefined;
}

export interface TreeDropInput {
  readonly doc: BuilderDocument;
  readonly registry: RegistryMeta;
  readonly rows: readonly LayerRow[];
  readonly item: DragItem;
  /** The pointer's distance from the top of the list's content (scroll included). */
  readonly y: number;
  readonly rowHeight: number;
}

/** The share of a row that counts as its edge; the middle is "inside". */
const EDGE = 0.25;

/**
 * Where a drop over the layers tree would land: the row under the pointer picks the spot (its top
 * quarter is before it, its bottom quarter after it, the middle inside it) and the rules
 * (`canInsert`/`canMove`) accept or refuse it. When they refuse, the nearest legal alternatives are
 * tried — inside the row's parent, then after each ancestor — so a drop on a leaf's edge that the
 * leaf's own slot does not allow still finds a home. Pure: nothing is dispatched.
 */
export function treeDropTarget(input: TreeDropInput): TreeDropResult | undefined {
  const { doc, registry, rows, item, y, rowHeight } = input;
  if (rows.length === 0 || !(rowHeight > 0)) return undefined;
  const rowIndex = Math.min(rows.length - 1, Math.max(0, Math.floor(y / rowHeight)));
  const row = rows[rowIndex];
  if (row === undefined) return undefined;
  const within = y / rowHeight - rowIndex;
  const isRoot = row.parentId === null;
  const position: TreePosition = isRoot
    ? 'inside'
    : within < EDGE
      ? 'before'
      : within > 1 - EDGE
        ? 'after'
        : 'inside';

  const index = createIndex(doc);
  const fragment = item.kind === 'nodes' ? undefined : fragmentFor(registry, item);
  if (item.kind !== 'nodes' && fragment === undefined) {
    return { target: null, rowIndex, position };
  }
  const ids = item.kind === 'nodes' ? item.ids : [];

  const endOf = (parentId: NodeId, slot: string) => {
    const children = doc.nodes[parentId]?.slots?.[slot] ?? [];
    // Moving out of the same slot leaves one gap less than the count.
    return children.length;
  };
  const beside = (id: NodeId, offset: 0 | 1): DropTarget | undefined => {
    const parentId = index.parentOf[id];
    const slot = index.slotOf[id];
    const at = index.indexOf[id];
    return parentId === undefined || slot === undefined || at === undefined
      ? undefined
      : { parentId, slot, index: at + offset };
  };

  const candidates: DropTarget[] = [];
  const push = (target: DropTarget | undefined) => {
    if (target !== undefined) candidates.push(target);
  };
  const inside = () => {
    const slots = new Set(['default', ...Object.keys(doc.nodes[row.id]?.slots ?? {})]);
    for (const slot of slots) push({ parentId: row.id, slot, index: endOf(row.id, slot) });
  };
  if (position === 'inside') inside();
  else push(beside(row.id, position === 'before' ? 0 : 1));
  if (position !== 'inside') inside();
  else if (!isRoot) push(beside(row.id, 1));
  for (let up = index.parentOf[row.id]; up !== undefined; up = index.parentOf[up]) {
    if (up === doc.root) break;
    // Right after a node that is itself being moved is where it already is.
    if (!ids.includes(up)) push(beside(up, 1));
  }

  let firstRefusal: Reason | undefined;
  for (const target of candidates) {
    const place = { parentId: target.parentId, slot: target.slot, at: target.index };
    let verdict: ReturnType<typeof canInsert>;
    if (fragment !== undefined) {
      verdict = canInsert(doc, index, registry, place, fragment);
    } else {
      // Every dragged node must be allowed there; the first that is not gives the reason.
      verdict = { ok: true, value: true };
      for (const id of ids) {
        const one = moveVerdict(doc, index, registry, id, target);
        if (!one.ok) {
          verdict = one;
          break;
        }
      }
    }
    if (verdict.ok) return { target, rowIndex, position };
    firstRefusal ??= verdict.error;
  }
  return { target: null, rowIndex, position, reason: firstRefusal };
}
