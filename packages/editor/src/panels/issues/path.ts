import {
  type BuilderDocument,
  createIndex,
  type NodeId,
  type RegistryManifest,
} from '@next-buildr/core';
import { componentMeta } from '../../app/manifest.tsx';

/**
 * "Block › Block": the names from the outermost block down to the node, without the page root.
 * Empty when the node is gone or is the root.
 */
export function issuePath(
  doc: BuilderDocument,
  manifest: RegistryManifest | undefined,
  id: NodeId | undefined,
): string {
  if (id === undefined || id === doc.root || !Object.hasOwn(doc.nodes, id)) return '';
  const index = createIndex(doc);
  const names: string[] = [];
  let at: NodeId | undefined = id;
  while (at !== undefined && at !== doc.root) {
    const node = doc.nodes[at];
    if (node === undefined) break;
    names.unshift(node.name ?? componentMeta(manifest, node.type)?.label ?? node.type);
    at = index.parentOf[at];
  }
  return names.join(' › ');
}
