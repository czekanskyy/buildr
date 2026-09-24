import { z } from 'zod';
import { PROTOCOL_SOURCE, PROTOCOL_VERSION } from './version.ts';

/**
 * The session nonce: random, minted by the editor into the canvas URL (`?session=`), confirmed at
 * the handshake and carried by every message after. URL-safe characters only, and long enough to
 * be unguessable.
 */
export const SESSION_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

/** A request id, and the id a reply names in `replyTo`. */
export const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const sessionSchema = z.string().regex(SESSION_PATTERN);
const messageIdSchema = z.string().regex(MESSAGE_ID_PATTERN);

/**
 * The fields every message has (docs/editor.md#the-postmessage-protocol), around `type` and
 * `payload`. `id` marks a request that wants an answer; a reply names it in `replyTo`.
 */
export const envelopeShape = {
  source: z.literal(PROTOCOL_SOURCE),
  protocol: z.literal(PROTOCOL_VERSION),
  session: sessionSchema,
  id: messageIdSchema.optional(),
  replyTo: messageIdSchema.optional(),
} as const;

/**
 * Just the envelope, with `type` and `payload` left open: what a receiver can check first (is this
 * one of ours, for this session, of this version) before it looks at what the message says.
 */
export const envelopeSchema = z.strictObject({
  ...envelopeShape,
  // Any version: a canvas of another version still gets its `canvas:hello` read, so the editor can
  // tell the person what is wrong instead of dropping the message. Every message then insists on 1.
  protocol: z.number().int().min(1).max(1_000_000),
  type: z.string().min(1).max(64),
  payload: z.unknown(),
});

export type Envelope = z.infer<typeof envelopeSchema>;
