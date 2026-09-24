// @buildr/react/canvas: CanvasRuntime, the page the editor embeds in its iframe. The overlay,
// inline edit and hit-testing (PB-068 - PB-071) build on the store exported here.
export { NodeBoundary } from './boundary.tsx';
export type { DataPreparer, DataPreparerOptions } from './data.ts';
export { createDataPreparer, DEFAULT_DATA_DEBOUNCE_MS, dataKey } from './data.ts';
export type { DndController, DndOptions } from './dnd/controller.ts';
export { createDndController } from './dnd/controller.ts';
export { buildHitPath, layoutAxisOf } from './dnd/hit-path.ts';
export type { InlineEditOptions } from './inline-edit.ts';
export { installInlineEdit } from './inline-edit.ts';
export type { InteractionOptions } from './interactions.ts';
export { installInteractions, instanceOf, nodeElementOf } from './interactions.ts';
export type { CanvasEnv, NodeViewProps } from './node-view.tsx';
export { CanvasEnvContext, NodeView } from './node-view.tsx';
export type { Box, Overlay, OverlayOptions } from './overlay/overlay.ts';
export { computeBoxes, createOverlay, openAncestorDetails } from './overlay/overlay.ts';
export type { CanvasRuntimeProps, CanvasTransport, ErrorTargetLike } from './runtime.tsx';
export { CanvasRuntime } from './runtime.tsx';
export type { CanvasLocales, CanvasState, CanvasStore, DropView, PatchOutcome } from './store.ts';
export { createCanvasStore } from './store.ts';
