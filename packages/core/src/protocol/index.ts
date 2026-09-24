// @buildr/core/protocol: canvas postMessage protocol - message schemas, createParentTransport,
// createChildTransport. The transports are added by docs/backlog/phase-08-protocol-canvas.md (PB-066).
export type { Envelope } from './envelope.ts';
export { envelopeSchema, MESSAGE_ID_PATTERN, SESSION_PATTERN, sessionSchema } from './envelope.ts';
export {
  dragItemSchema,
  dropTargetSchema,
  MAX_DIAGNOSTICS,
  MAX_INLINE_TEXT,
  MAX_PATCH_PATH,
  MAX_PATCHES,
  MAX_SELECTION,
  patchSchema,
} from './messages.ts';
export type {
  CanvasMessage,
  CanvasMessageType,
  EditorMessage,
  EditorMessageType,
  Message,
  MessageOptions,
  MessageType,
  PayloadOf,
} from './parse.ts';
export {
  canvasMessageSchema,
  createMessage,
  editorMessageSchema,
  MESSAGE_DIRECTION,
  MESSAGE_TYPES,
  messageSchema,
  parseCanvasMessage,
  parseEditorMessage,
  parseEnvelope,
  parseMessage,
} from './parse.ts';
export { PROTOCOL_SOURCE, PROTOCOL_VERSION } from './version.ts';
