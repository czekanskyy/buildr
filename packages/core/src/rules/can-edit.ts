import type { DocumentIndex } from '../document/document-index.ts';
import type { BuilderDocument, NodeId } from '../document/types.ts';
import { err, ok, type Result } from '../result/index.ts';
import { isLocked } from './locks.ts';
import { type Reason, reason } from './reasons.ts';

/** The two things a node's own `lock` can protect besides its structure. */
export type EditAspect = 'content' | 'style';

/**
 * Whether `nodeId`'s own props (`aspect: 'content'`) or style overrides (`aspect: 'style'`) can
 * be edited — checks `lock.content`/`lock.style` on the node itself or the nearest ancestor
 * carrying it, unless a `region` marker in between reopens editing
 * (docs/templates.md#locks-and-regions).
 */
export function canEdit(
  doc: BuilderDocument,
  index: DocumentIndex,
  nodeId: NodeId,
  aspect: EditAspect,
): Result<true, Reason> {
  const node = doc.nodes[nodeId];
  if (!node) {
    return err(reason('node-not-found', `Node "${nodeId}" does not exist.`, { nodeId }));
  }

  if (isLocked(doc, index, nodeId, aspect)) {
    return err(
      aspect === 'content'
        ? reason('locked-content', "This node's content is locked.", { nodeId })
        : reason('locked-style', "This node's style is locked.", { nodeId }),
    );
  }

  return ok(true);
}
