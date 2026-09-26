import type { NodeId } from '@next-buildr/core';
import type { CanvasInstrumentation } from './types.ts';

export type { CanvasInstrumentation } from './types.ts';

/**
 * The minimal instrumentation the canvas needs to find nodes again: `data-bid` on every root. The
 * canvas runtime layers its `NodeView`, placeholders and error boundaries on top of this
 * (PB-070); it is here so the shared renderer and the canvas agree on the attribute.
 */
export const withNodeIds: CanvasInstrumentation = {
  rootAttributes: (node) => ({ 'data-bid': node.id satisfies NodeId }),
};
