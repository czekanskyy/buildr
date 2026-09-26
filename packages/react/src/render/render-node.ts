import {
  type Diagnostic,
  isJsonValue,
  type JsonValue,
  mediaRefSchema,
  type NodeId,
  type PageNode,
  resolveProps,
  resolveVisibility,
  type SlotName,
} from '@next-buildr/core';
import { createElement, type ReactNode } from 'react';
import type { BuilderComponentProps, ComponentDefinition, NodeRoot } from '../define/types.ts';
import { loopSlots } from './loop.ts';
import { buildRootAttributes } from './root-attrs.ts';
import type { RenderRun, RenderTreeOptions } from './types.ts';

function nodeDiagnostic(
  code: string,
  message: string,
  node: PageNode,
  severity: Diagnostic['severity'] = 'warning',
  extra: Record<string, JsonValue> = {},
): Diagnostic {
  return { code, message, severity, details: { nodeId: node.id, type: node.type, ...extra } };
}

/**
 * A media prop resolves to a reference (`{ source, collection, id }`); the component should get
 * the asset itself. The asset comes from `PreparedData.media`; without it the reference's own
 * snapshot is the best there is, and without that the reference is left as it was.
 */
function withMediaAssets(
  node: PageNode,
  def: ComponentDefinition,
  props: Readonly<Record<string, JsonValue>>,
  run: RenderRun,
): Readonly<Record<string, JsonValue>> {
  let out: Record<string, JsonValue> | undefined;
  for (const [name, propDef] of Object.entries(def.meta.props)) {
    if (propDef.kind !== 'media') continue;
    const value = Object.hasOwn(props, name) ? props[name] : undefined;
    const ref = mediaRefSchema.safeParse(value);
    if (!ref.success) continue;

    const asset = Object.hasOwn(run.options.data.media, ref.data.id)
      ? run.options.data.media[ref.data.id]
      : undefined;
    let resolved: JsonValue | undefined;
    if (asset !== undefined) {
      resolved = JSON.parse(JSON.stringify(asset)) as JsonValue;
    } else if (ref.data.snapshot !== undefined) {
      const { url, alt, width, height, mimeType } = ref.data.snapshot;
      resolved = {
        id: ref.data.id,
        url,
        mimeType: mimeType ?? '',
        ...(alt !== undefined ? { alt } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      };
      run.report([
        nodeDiagnostic(
          'render.media-snapshot',
          `media "${ref.data.id}" was not prepared; using the copy stored with the reference`,
          node,
          'warning',
          { prop: name },
        ),
      ]);
    } else {
      run.report([
        nodeDiagnostic(
          'render.media-missing',
          `media "${ref.data.id}" was not prepared`,
          node,
          'error',
          {
            prop: name,
          },
        ),
      ]);
    }
    if (resolved !== undefined) {
      out ??= { ...props };
      out[name] = resolved;
    }
  }
  return out ?? props;
}

/**
 * Renders a child of a slot: in place, or, when the canvas asked for lazy children, as an element
 * that renders it on its own later (`instrument.lazyChild`).
 */
export function renderChild(id: NodeId, run: RenderRun): ReactNode {
  const lazy = run.options.instrument?.lazyChild;
  if (lazy === undefined) return renderNode(id, run);
  const child = Object.hasOwn(run.doc.nodes, id) ? run.doc.nodes[id] : undefined;
  if (child === undefined) return null;
  return lazy(child, {
    context: run.options.context,
    instance: run.instance,
    parents: [...run.parents],
    path: [...run.path],
  });
}

function renderSlots(
  node: PageNode,
  def: ComponentDefinition,
  props: Readonly<Record<string, JsonValue>>,
  run: RenderRun,
): Record<SlotName, ReactNode> {
  const loop = loopSlots(node, def, props, run, renderChild);
  if (loop !== undefined) return loop;
  const slots: Record<SlotName, ReactNode> = {};
  for (const slot of Object.keys(def.meta.slots ?? {})) {
    const ids =
      node.slots !== undefined && Object.hasOwn(node.slots, slot) ? node.slots[slot] : undefined;
    if (ids === undefined || ids.length === 0) {
      slots[slot] = run.options.instrument?.emptySlot?.(node, slot) ?? null;
      continue;
    }
    slots[slot] = ids.map((id) => renderChild(id, run));
  }
  return slots;
}

/**
 * Renders one node and, through its slots, everything below it. A `visibleIf` that resolves falsy
 * yields `null`; an unregistered component yields `null` (or the canvas's placeholder) and a
 * diagnostic; otherwise the props are resolved and the component is created with them.
 * Synchronous, and uses no hooks or context: the same walk runs in an RSC and in the canvas.
 */
export function renderNode(id: NodeId, run: RenderRun, bare = false): ReactNode {
  const node = Object.hasOwn(run.doc.nodes, id) ? run.doc.nodes[id] : undefined;
  if (node === undefined) return null;

  if (run.path.has(id)) {
    run.report([nodeDiagnostic('render.cycle', `node "${id}" contains itself`, node, 'error')]);
    return null;
  }

  const { options } = run;
  const visibility = resolveVisibility(node, options.context, cacheOption(run));
  run.report(visibility.diagnostics);
  if (!visibility.visible) return null;

  const def = options.registry.get(node.type);
  if (def === undefined) {
    run.report([
      nodeDiagnostic(
        'render.unknown-component',
        `"${node.type}" is not a registered component`,
        node,
      ),
    ]);
    return wrap(node, options.instrument?.unknownComponent?.(node) ?? null, run, bare);
  }

  const resolved = resolveProps(node, def.meta, options.context, cacheOption(run));
  run.report(resolved.diagnostics);
  const props = withMediaAssets(node, def, resolved.props, run);

  const parent = run.parents[run.parents.length - 1];
  run.path.add(id);
  run.parents.push({ id: node.id, type: node.type, props });
  let slots: Record<SlotName, ReactNode>;
  try {
    slots = renderSlots(node, def, props, run);
  } finally {
    run.parents.pop();
    run.path.delete(id);
  }

  const root = buildRootAttributes(node, {
    ...options.instrument?.rootAttributes?.(node),
    ...instanceAttributes(node, run),
  });
  const componentProps: BuilderComponentProps = {
    props: props as BuilderComponentProps['props'],
    root,
    slots,
    ...(slots['default'] !== undefined ? { children: slots['default'] } : {}),
    node: { id: node.id, type: node.type, ...(parent !== undefined ? { parent } : {}) },
    env: run.env,
    ...(def.meta.runtime === 'shared' ? { platform: options.platform } : {}),
  };

  if (run.devChecks && def.meta.runtime === 'client') assertSerializable(node, componentProps);

  return wrap(
    node,
    createElement(def.render, { key: keyOf(node, run), ...componentProps }),
    run,
    bare,
  );
}

/** `${id}:${index}` inside a loop, so the instances of one node never share a key. */
function keyOf(node: PageNode, run: RenderRun): string {
  const index = run.instance[run.instance.length - 1];
  return index === undefined ? node.id : `${node.id}:${index}`;
}

/**
 * What a node inside a loop instance gets: its anchor made unique (`pricing-2`, `pricing-1-3` in
 * nested loops) and, for the canvas, `data-bi` — the instance it is part of.
 */
function instanceAttributes(node: PageNode, run: RenderRun): Partial<NodeRoot> {
  const index = run.instance[run.instance.length - 1];
  if (index === undefined) return {};
  return {
    ...(node.anchor !== undefined && node.anchor !== ''
      ? { id: `${node.anchor}-${run.instance.join('-')}` }
      : {}),
    ...(run.options.instrument !== undefined ? { 'data-bi': index } : {}),
  };
}

function cacheOption(
  run: RenderRun,
): { cache: NonNullable<RenderTreeOptions['cache']> } | undefined {
  return run.options.cache === undefined ? undefined : { cache: run.options.cache };
}

/** Puts the canvas's `NodeView` around a node, when there is one (a node rendered on its own, `bare`, is already inside its view). */
function wrap(node: PageNode, element: ReactNode, run: RenderRun, bare: boolean): ReactNode {
  const View = run.options.instrument?.NodeView;
  return bare || View === undefined
    ? element
    : createElement(View, { key: keyOf(node, run), node }, element);
}

/**
 * A client component's props cross the server/client boundary, so they must be plain JSON. Slots
 * are excluded — they are React elements, which the boundary does carry. Development only.
 */
function assertSerializable(node: PageNode, props: BuilderComponentProps): void {
  const { slots: _slots, children: _children, ...crossing } = props;
  if (!isJsonValue(crossing)) {
    throw new Error(
      `"${node.type}" is runtime: 'client', but its props (node ${node.id}) are not serializable; ` +
        'check what the instrumentation adds to the root attributes.',
    );
  }
}
