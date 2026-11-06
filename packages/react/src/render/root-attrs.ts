import {
  authorNodeAttributes,
  type HostCapabilities,
  nodeClassName,
  type PageNode,
} from '@next-buildr/core';
import type { NodeRoot } from '../define/types.ts';

/**
 * The class a component's own stylesheet uses: `buildr/heading` is `bc-heading`; another
 * namespace keeps it, so `acme/pricing-table` is `bc-acme-pricing-table` and cannot collide.
 */
export function componentClassName(type: string): string {
  const [namespace, name] = type.split('/');
  if (name === undefined) return `bc-${type.replaceAll('/', '-')}`;
  return namespace === 'buildr' ? `bc-${name}` : `bc-${namespace}-${name}`;
}

/**
 * The attributes a component spreads onto its root element: its own class, the node's style class
 * (`b-<id>`, which the compiled stylesheet targets) and the anchor as the HTML `id`. No wrapper
 * element is ever added, so `flex`/`grid` layouts and `> *` selectors see the real children.
 *
 * The author's class names and attributes (ADR-026) are added only when `capabilities.authorCode`
 * is `true`, and only what `authorNodeAttributes` lets through. They never replace the generated
 * class, the anchor or the canvas's own attributes.
 */
export function buildRootAttributes(
  node: PageNode,
  extra?: Partial<NodeRoot>,
  capabilities?: HostCapabilities,
): NodeRoot {
  const author = authorNodeAttributes(node, capabilities);
  const own = `${componentClassName(node.type)} ${nodeClassName(node.id)}`;
  return {
    ...author.attributes,
    className: author.classes.length === 0 ? own : `${own} ${author.classes.join(' ')}`,
    ...(node.anchor !== undefined && node.anchor !== '' ? { id: node.anchor } : {}),
    ...extra,
  };
}
