import { nodeClassName, type PageNode } from '@buildr/core';
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
 */
export function buildRootAttributes(node: PageNode, extra?: Partial<NodeRoot>): NodeRoot {
  return {
    className: `${componentClassName(node.type)} ${nodeClassName(node.id)}`,
    ...(node.anchor !== undefined && node.anchor !== '' ? { id: node.anchor } : {}),
    ...extra,
  };
}
