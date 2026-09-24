import { z } from 'zod';
import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import { envelopeSchema } from './envelope.ts';
import { canvasMessages, editorMessages } from './messages.ts';

/** A message the editor sends to the canvas. */
export const editorMessageSchema = z.discriminatedUnion('type', editorMessages);
/** A message the canvas sends to the editor. */
export const canvasMessageSchema = z.discriminatedUnion('type', canvasMessages);
/** Any message of the protocol. */
export const messageSchema = z.discriminatedUnion('type', [...editorMessages, ...canvasMessages]);

export type EditorMessage = z.infer<typeof editorMessageSchema>;
export type CanvasMessage = z.infer<typeof canvasMessageSchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessageType = Message['type'];
export type EditorMessageType = EditorMessage['type'];
export type CanvasMessageType = CanvasMessage['type'];

/** The payload of the message of type `T`. */
export type PayloadOf<T extends MessageType> = Extract<Message, { type: T }>['payload'];

/** Which side sends each type, so a receiver can refuse a type its peer has no business sending. */
export const MESSAGE_DIRECTION: Readonly<
  Record<MessageType, 'editor-to-canvas' | 'canvas-to-editor'>
> = Object.freeze({
  ...Object.fromEntries(
    editorMessages.map((m) => [m.shape.type.value, 'editor-to-canvas' as const]),
  ),
  ...Object.fromEntries(
    canvasMessages.map((m) => [m.shape.type.value, 'canvas-to-editor' as const]),
  ),
}) as Readonly<Record<MessageType, 'editor-to-canvas' | 'canvas-to-editor'>>;

/** Every type of the protocol, editor's first. */
export const MESSAGE_TYPES: readonly MessageType[] = Object.freeze([
  ...editorMessages.map((m) => m.shape.type.value),
  ...canvasMessages.map((m) => m.shape.type.value),
]) as readonly MessageType[];

/** Why a message was refused: one diagnostic, short enough to log. */
function invalid(error: z.ZodError): Diagnostic {
  const issue = error.issues[0];
  const path = issue?.path.filter((s): s is string | number => typeof s !== 'symbol') ?? [];
  return {
    code: 'protocol.invalid-message',
    message:
      `${path.length > 0 ? `${path.join('.')}: ` : ''}${issue?.message ?? 'invalid message'}`.slice(
        0,
        300,
      ),
    severity: 'error',
    ...(path.length > 0 ? { path } : {}),
  };
}

function parseWith<S extends z.ZodType>(schema: S, input: unknown): Result<z.infer<S>, Diagnostic> {
  try {
    const result = schema.safeParse(input);
    return result.success ? ok(result.data) : err(invalid(result.error));
  } catch {
    // Data that arrived by postMessage was cloned and cannot have a throwing getter, but a
    // receiver must not depend on that.
    return err({
      code: 'protocol.invalid-message',
      message: 'the message could not be read',
      severity: 'error',
    });
  }
}

/**
 * Checks `input` (whatever arrived in a `MessageEvent`) as a message the editor sends. Never
 * throws; a refused message becomes a diagnostic to log in development and otherwise drop.
 */
export function parseEditorMessage(input: unknown): Result<EditorMessage, Diagnostic> {
  return parseWith(editorMessageSchema, input);
}

/** The same for a message the canvas sends. */
export function parseCanvasMessage(input: unknown): Result<CanvasMessage, Diagnostic> {
  return parseWith(canvasMessageSchema, input);
}

/** The same for either direction. */
export function parseMessage(input: unknown): Result<Message, Diagnostic> {
  return parseWith(messageSchema, input);
}

/**
 * Checks only the envelope of `input`: is it one of ours, of this protocol version, with a
 * well-formed session. A transport does this first and compares the session itself before it
 * spends time on the payload.
 */
export function parseEnvelope(input: unknown) {
  return parseWith(envelopeSchema, input);
}

export interface MessageOptions {
  readonly session: string;
  /** Marks a request that wants an answer. */
  readonly id?: string;
  /** Marks the answer to the request with this id. */
  readonly replyTo?: string;
}

/**
 * Builds a message of type `type`, with the envelope filled in. The result is checked by the
 * receiver like any other; this only saves the sender the boilerplate and keeps the payload typed.
 */
export function createMessage<T extends MessageType>(
  type: T,
  payload: PayloadOf<T>,
  options: MessageOptions,
): Extract<Message, { type: T }> {
  return {
    source: 'buildr',
    protocol: 1,
    session: options.session,
    ...(options.id === undefined ? {} : { id: options.id }),
    ...(options.replyTo === undefined ? {} : { replyTo: options.replyTo }),
    type,
    payload,
  } as Extract<Message, { type: T }>;
}
