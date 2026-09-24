// @buildr/core/protocol: canvas postMessage protocol - message schemas, createParentTransport,
// createChildTransport.
export type { ChildTransportOptions } from './child-transport.ts';
export { createChildTransport } from './child-transport.ts';
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
export { assertConcreteOrigin } from './origins.ts';
export type { ParentTransportOptions } from './parent-transport.ts';
export { createParentTransport } from './parent-transport.ts';
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
export type {
  Channel,
  Rejection,
  RejectReason,
  RequestOptions,
  Transport,
  TransportOptions,
} from './transport.ts';
export { createTransport, DEFAULT_REQUEST_TIMEOUT_MS, TransportError } from './transport.ts';
export { PROTOCOL_SOURCE, PROTOCOL_VERSION } from './version.ts';
export type {
  FrameLike,
  MessageEventLike,
  PostTarget,
  Timers,
  WindowLike,
} from './window-like.ts';
