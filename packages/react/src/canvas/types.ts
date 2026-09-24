import type { CanvasMessage, EditorMessage, Transport } from '@buildr/core/protocol';

/** The channel to the editor, as the canvas uses it. */
export type CanvasTransport = Transport<CanvasMessage, EditorMessage>;
