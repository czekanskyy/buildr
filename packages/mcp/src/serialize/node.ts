import type {
  BuilderDocument,
  ComponentType,
  NodeId,
  PageNode,
  RegistryMeta,
  Result,
  Value,
} from '@next-buildr/core';
import { createIndex, err, ok } from '@next-buildr/core';
import { quote } from './text.ts';

export interface NodeDetail {
  readonly id: NodeId;
  readonly type: ComponentType;
  readonly label?: string;
  readonly name?: string;
  readonly anchor?: string;
  readonly parent?: { readonly id: NodeId; readonly slot: string; readonly index: number };
  /** Props stored on the node; a prop not listed here uses `defaults`. */
  readonly props: Readonly<Record<string, Value>>;
  /** Props of the component that the node does not set, with their default values. */
  readonly defaults: Readonly<Record<string, unknown>>;
  /** Style overrides per layer: `base`, `bp` (per breakpoint) and `state`. */
  readonly styles?: NonNullable<PageNode['styles']>;
  readonly lock?: NonNullable<PageNode['lock']>;
  readonly region?: string;
  readonly visibleIf?: unknown;
  readonly template?: { readonly template: string; readonly version: number };
  /** Child ids per slot, with their types, in order. */
  readonly slots: Readonly<
    Record<string, readonly { readonly id: NodeId; readonly type: ComponentType }[]>
  >;
}

export interface NodeDetailError {
  readonly code: 'node-not-found';
  readonly message: string;
}

/** Everything about one node: all props as `Value`s, styles per layer, attributes, its place. */
export function describeNode(
  doc: BuilderDocument,
  registry: RegistryMeta,
  nodeId: NodeId,
): Result<NodeDetail, NodeDetailError> {
  const node = Object.hasOwn(doc.nodes, nodeId) ? doc.nodes[nodeId] : undefined;
  if (!node) {
    return err({
      code: 'node-not-found',
      message: `There is no node "${nodeId}" in this document; ids come from the outline.`,
    });
  }
  const meta = registry.get(node.type);
  const index = createIndex(doc);
  const parentId = index.parentOf[nodeId];
  const slot = index.slotOf[nodeId];
  const position =
    parentId !== undefined && slot !== undefined
      ? (doc.nodes[parentId]?.slots?.[slot] ?? []).indexOf(nodeId)
      : -1;
  const defaults: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(meta?.props ?? {})) {
    if (node.props?.[name] === undefined) defaults[name] = def.default;
  }
  const slots: Record<string, { id: NodeId; type: ComponentType }[]> = {};
  const slotNames = [
    ...new Set([...Object.keys(meta?.slots ?? {}), ...Object.keys(node.slots ?? {})]),
  ];
  for (const name of slotNames) {
    slots[name] = (node.slots?.[name] ?? []).flatMap((childId) => {
      const child = doc.nodes[childId];
      return child ? [{ id: childId, type: child.type }] : [];
    });
  }
  return ok({
    id: node.id,
    type: node.type,
    ...(meta ? { label: meta.label } : {}),
    ...(node.name !== undefined ? { name: node.name } : {}),
    ...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
    ...(parentId !== undefined && slot !== undefined && position >= 0
      ? { parent: { id: parentId, slot, index: position } }
      : {}),
    props: node.props ?? {},
    defaults,
    ...(node.styles !== undefined ? { styles: node.styles } : {}),
    ...(node.lock !== undefined ? { lock: node.lock } : {}),
    ...(node.region !== undefined ? { region: node.region } : {}),
    ...(node.visibleIf !== undefined ? { visibleIf: node.visibleIf } : {}),
    ...(node.source !== undefined ? { template: node.source } : {}),
    slots,
  });
}

function valueText(value: Value): string {
  switch (value.kind) {
    case 'static': {
      const translations =
        value.l10n !== undefined && Object.keys(value.l10n).length > 0
          ? ` l10n=${JSON.stringify(value.l10n)}`
          : '';
      return `static ${JSON.stringify(value.value)}${translations}`;
    }
    case 'binding':
      return `binding ${value.path}${value.format ? ` format=${JSON.stringify(value.format)}` : ''}${
        value.fallback !== undefined ? ` fallback=${JSON.stringify(value.fallback)}` : ''
      }`;
    case 'expression':
      return `expression${value.mode === 'template' ? ' (template)' : ''} ${quote(value.expr, 200)}${
        value.l10n !== undefined ? ` l10n=${JSON.stringify(value.l10n)}` : ''
      }`;
  }
}

/** A compact text rendering of `describeNode` for clients that read text. */
export function formatNodeDetail(detail: NodeDetail): string {
  const lines: string[] = [
    `${detail.id} ${detail.type}${detail.label ? ` (${detail.label})` : ''}`,
  ];
  if (detail.name !== undefined) lines.push(`name: ${quote(detail.name, 80)}`);
  if (detail.anchor !== undefined) lines.push(`anchor: ${detail.anchor}`);
  if (detail.parent) {
    lines.push(
      `parent: ${detail.parent.id} slot "${detail.parent.slot}" index ${detail.parent.index}`,
    );
  }
  if (detail.lock) lines.push(`lock: ${Object.keys(detail.lock).join(', ')}`);
  if (detail.region !== undefined) lines.push(`region: ${detail.region}`);
  if (detail.template)
    lines.push(`from template: ${detail.template.template} v${detail.template.version}`);
  if (detail.visibleIf !== undefined) lines.push(`visibleIf: ${JSON.stringify(detail.visibleIf)}`);
  const props = Object.entries(detail.props);
  lines.push(props.length === 0 ? 'props: (all defaults)' : 'props:');
  for (const [name, value] of props) lines.push(`  ${name}: ${valueText(value)}`);
  const defaults = Object.entries(detail.defaults);
  if (defaults.length > 0) {
    lines.push(`defaults: ${defaults.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}`);
  }
  if (detail.styles) lines.push(`styles: ${JSON.stringify(detail.styles)}`);
  for (const [name, children] of Object.entries(detail.slots)) {
    lines.push(
      `slot ${name}: ${children.length === 0 ? '(empty)' : children.map((c) => `${c.id}(${c.type})`).join(', ')}`,
    );
  }
  return lines.join('\n');
}
