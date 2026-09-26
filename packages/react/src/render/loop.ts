import {
  type Diagnostic,
  type JsonValue,
  type NodeId,
  type PageNode,
  pushScope,
  queryKey,
  resolveBinding,
  type SlotName,
} from '@next-buildr/core';
import type { ReactNode } from 'react';
import type { ComponentDefinition } from '../define/types.ts';
import type { RenderRun } from './types.ts';

/** The most items one loop renders; a longer list is cut and reported, so a huge binding cannot stall a render. */
export const MAX_LOOP_ITEMS = 1000;

interface LoopList {
  readonly items: readonly JsonValue[];
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
}

const EMPTY_LIST: LoopList = { items: [], page: 1, totalPages: 0, total: 0 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loopDiagnostic(node: PageNode, prop: string, code: string, message: string): Diagnostic {
  return { code, message, severity: 'warning', details: { nodeId: node.id, prop } };
}

/** The list a loop iterates: a bound list, or the query result `prepareRender` fetched. */
function readList(
  node: PageNode,
  prop: string,
  source: JsonValue | undefined,
  run: RenderRun,
): LoopList {
  if (source === undefined || source === null) return EMPTY_LIST;
  const fromArray = (items: readonly JsonValue[]): LoopList => ({
    items,
    page: 1,
    totalPages: items.length === 0 ? 0 : 1,
    total: items.length,
  });

  // A `Value` binding on the whole prop already resolved to the list itself.
  if (Array.isArray(source)) return fromArray(source);

  if (isRecord(source) && source['type'] === 'binding' && typeof source['path'] === 'string') {
    const resolved = resolveBinding({ kind: 'binding', path: source['path'] }, run.options.context);
    run.report(
      resolved.diagnostics.map((d) => ({ ...d, details: { ...d.details, nodeId: node.id, prop } })),
    );
    if (Array.isArray(resolved.value)) return fromArray(resolved.value);
    if (resolved.value !== undefined) {
      run.report([
        loopDiagnostic(node, prop, 'render.loop-source', `"${source['path']}" is not a list`),
      ]);
    }
    return EMPTY_LIST;
  }

  if (isRecord(source) && source['type'] === 'query') {
    const key = queryKey(node.id, prop);
    const result = Object.hasOwn(run.options.data.queries, key)
      ? run.options.data.queries[key]
      : undefined;
    if (result === undefined) {
      run.report([
        loopDiagnostic(
          node,
          prop,
          'render.loop-query-missing',
          'the query result was not prepared',
        ),
      ]);
      return EMPTY_LIST;
    }
    return result;
  }

  run.report([
    loopDiagnostic(node, prop, 'render.loop-source', 'the list source is not understood'),
  ]);
  return EMPTY_LIST;
}

/**
 * The slots of a loop (docs/renderer.md#loop-slots-rich-text) — any component with a `listSource`
 * prop. `item` is rendered once per list entry under `item` / `index` / `loop` scopes (and the
 * `as` alias), `empty` only when the list is empty, `after` once under the `loop` scope (a place
 * for pagination); other slots render as usual. Returns `undefined` for a component that is not a
 * loop, so the caller renders its slots the ordinary way.
 */
export function loopSlots(
  node: PageNode,
  def: ComponentDefinition,
  props: Readonly<Record<string, JsonValue>>,
  run: RenderRun,
  render: (id: NodeId, run: RenderRun) => ReactNode,
): Record<SlotName, ReactNode> | undefined {
  const sourceProp = Object.entries(def.meta.props).find(([, p]) => p.kind === 'listSource')?.[0];
  if (sourceProp === undefined) return undefined;

  const source = Object.hasOwn(props, sourceProp) ? props[sourceProp] : undefined;
  const list = readList(node, sourceProp, source, run);
  let items = list.items;
  if (items.length > MAX_LOOP_ITEMS) {
    run.report([
      loopDiagnostic(
        node,
        sourceProp,
        'render.loop-truncated',
        `only the first ${MAX_LOOP_ITEMS} of ${items.length} items are rendered`,
      ),
    ]);
    items = items.slice(0, MAX_LOOP_ITEMS);
  }
  const aliasValue = Object.hasOwn(props, 'as') ? props['as'] : undefined;
  const alias = typeof aliasValue === 'string' && aliasValue !== '' ? aliasValue : undefined;
  const loop: JsonValue = { page: list.page, totalPages: list.totalPages, total: list.total };

  const scoped = (scopes: Record<string, JsonValue>, index?: number): RenderRun => ({
    ...run,
    options: { ...run.options, context: pushScope(run.options.context, scopes) },
    instance: index === undefined ? run.instance : [...run.instance, index],
  });
  const childrenOf = (slot: SlotName): readonly NodeId[] =>
    node.slots !== undefined && Object.hasOwn(node.slots, slot) ? (node.slots[slot] ?? []) : [];

  const slots: Record<SlotName, ReactNode> = {};
  for (const slot of Object.keys(def.meta.slots ?? {})) {
    const ids = childrenOf(slot);
    const placeholder = () => run.options.instrument?.emptySlot?.(node, slot) ?? null;

    if (slot === 'item') {
      if (ids.length === 0) slots[slot] = placeholder();
      else {
        slots[slot] = items.flatMap((item, index) => {
          const instance = scoped(
            { item, index, loop, ...(alias !== undefined ? { [alias]: item } : {}) },
            index,
          );
          return ids.map((id) => render(id, instance));
        });
      }
    } else if (slot === 'empty') {
      if (items.length > 0) slots[slot] = null;
      else slots[slot] = ids.length === 0 ? placeholder() : ids.map((id) => render(id, run));
    } else if (slot === 'after') {
      const after = scoped({ loop });
      slots[slot] = ids.length === 0 ? placeholder() : ids.map((id) => render(id, after));
    } else {
      slots[slot] = ids.length === 0 ? placeholder() : ids.map((id) => render(id, run));
    }
  }
  return slots;
}
