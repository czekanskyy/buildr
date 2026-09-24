import {
  type BuilderDocument,
  type Diagnostic,
  isJsonValue,
  type JsonValue,
  mediaRefSchema,
  type NodeId,
  type PageNode,
  resolveProps,
  resolveVisibility,
  type SlotName,
} from '@buildr/core';
import { createElement, type ReactNode } from 'react';
import type { BuilderComponentProps, ComponentDefinition, ComponentEnv } from '../define/types.ts';
import { buildRootAttributes } from './root-attrs.ts';
import type { RenderTreeOptions } from './types.ts';

/** Everything one render walk shares. Plain data and functions: no React context, no hooks. */
export interface RenderRun {
  readonly doc: BuilderDocument;
  readonly options: RenderTreeOptions;
  readonly env: ComponentEnv;
  readonly devChecks: boolean;
  /** The nodes between the root and the one being rendered, to stop a cyclic document. */
  readonly path: Set<NodeId>;
  report(diagnostics: readonly Diagnostic[]): void;
}

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

function renderSlots(
  node: PageNode,
  def: ComponentDefinition,
  run: RenderRun,
): Record<SlotName, ReactNode> {
  const slots: Record<SlotName, ReactNode> = {};
  for (const slot of Object.keys(def.meta.slots ?? {})) {
    const ids =
      node.slots !== undefined && Object.hasOwn(node.slots, slot) ? node.slots[slot] : undefined;
    if (ids === undefined || ids.length === 0) {
      slots[slot] = run.options.instrument?.emptySlot?.(node, slot) ?? null;
      continue;
    }
    slots[slot] = ids.map((id) => renderNode(id, run));
  }
  return slots;
}

/**
 * Renders one node and, through its slots, everything below it. A `visibleIf` that resolves falsy
 * yields `null`; an unregistered component yields `null` (or the canvas's placeholder) and a
 * diagnostic; otherwise the props are resolved and the component is created with them.
 * Synchronous, and uses no hooks or context: the same walk runs in an RSC and in the canvas.
 */
export function renderNode(id: NodeId, run: RenderRun): ReactNode {
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
    return wrap(node, options.instrument?.unknownComponent?.(node) ?? null, run);
  }

  const resolved = resolveProps(node, def.meta, options.context, cacheOption(run));
  run.report(resolved.diagnostics);
  const props = withMediaAssets(node, def, resolved.props, run);

  run.path.add(id);
  let slots: Record<SlotName, ReactNode>;
  try {
    slots = renderSlots(node, def, run);
  } finally {
    run.path.delete(id);
  }

  const root = buildRootAttributes(node, options.instrument?.rootAttributes?.(node));
  const componentProps: BuilderComponentProps = {
    props: props as BuilderComponentProps['props'],
    root,
    slots,
    ...(slots['default'] !== undefined ? { children: slots['default'] } : {}),
    node: { id: node.id, type: node.type },
    env: run.env,
    ...(def.meta.runtime === 'shared' ? { platform: options.platform } : {}),
  };

  if (run.devChecks && def.meta.runtime === 'client') assertSerializable(node, componentProps);

  return wrap(node, createElement(def.render, { key: node.id, ...componentProps }), run);
}

function cacheOption(
  run: RenderRun,
): { cache: NonNullable<RenderTreeOptions['cache']> } | undefined {
  return run.options.cache === undefined ? undefined : { cache: run.options.cache };
}

/** Puts the canvas's `NodeView` around a node, when there is one. */
function wrap(node: PageNode, element: ReactNode, run: RenderRun): ReactNode {
  const View = run.options.instrument?.NodeView;
  return View === undefined ? element : createElement(View, { key: node.id, node }, element);
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
