// @buildr/react/canvas: CanvasRuntime, the page the editor embeds in its iframe. The overlay,
// inline edit and hit-testing (PB-068 - PB-071) build on the store exported here.
export { NodeBoundary } from './boundary.tsx';
export type { CanvasEnv, NodeViewProps } from './node-view.tsx';
export { CanvasEnvContext, NodeView } from './node-view.tsx';
export type { CanvasRuntimeProps, CanvasTransport, ErrorTargetLike } from './runtime.tsx';
export { CanvasRuntime } from './runtime.tsx';
export type { CanvasLocales, CanvasState, CanvasStore, PatchOutcome } from './store.ts';
export { createCanvasStore } from './store.ts';
