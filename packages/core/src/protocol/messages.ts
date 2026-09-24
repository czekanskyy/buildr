import { z } from 'zod';
import { documentSchema, RANDOM_NODE_ID_PATTERN } from '../document/schema.ts';
import { isJsonValue, type JsonValue } from '../json/json-value.ts';
import { envelopeShape } from './envelope.ts';

// The payload of every message of docs/editor.md#the-postmessage-protocol. These are limits on
// what a receiver will take, not on what the editor sends: a message over a limit is dropped
// whole, so the limits sit well above anything an honest editor or canvas produces.

const nodeIdSchema = z.union([z.literal('root'), z.string().regex(RANDOM_NODE_ID_PATTERN)]);
const jsonSchema = z.custom<JsonValue>(isJsonValue, { message: 'must be a JSON value' });

/** A whole number that is a version of the document: 0 is the document as first loaded. */
const versionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const pointSchema = z.strictObject({ x: coordinate, y: coordinate });

const modifiersSchema = z.strictObject({
  shift: z.boolean(),
  alt: z.boolean(),
  ctrl: z.boolean(),
  meta: z.boolean(),
});

const BREAKPOINT_ID = /^[a-z][a-z0-9-]{0,31}$/;
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/;
const PROP_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export const MAX_SELECTION = 1000;
export const MAX_PATCHES = 10_000;
export const MAX_PATCH_PATH = 24;
export const MAX_DIAGNOSTICS = 500;
export const MAX_INLINE_TEXT = 20_000;

const viewportSchema = z.strictObject({
  breakpoint: z.string().regex(BREAKPOINT_ID),
  width: z.number().int().min(240).max(4096),
});

const localeSchema = z.string().regex(LOCALE).max(35);

const localesSchema = z
  .strictObject({
    locales: z.array(localeSchema).min(1).max(50),
    default: localeSchema,
    fallback: z.boolean(),
    intl: z.record(localeSchema, z.string().max(100)),
  })
  .refine((config) => config.locales.includes(config.default), {
    message: 'the default locale must be one of the locales',
    path: ['default'],
  });

/** Where the sample data comes from (a document, a template's context): opaque to the protocol. */
const contextRefSchema = z.string().min(1).max(200).nullable();

const modeSchema = z.enum(['edit', 'interact']);

// --- Immer patches -----------------------------------------------------------------------------

/** Keys that would reach an object's prototype rather than its data. */
const FORBIDDEN_SEGMENTS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

const pathSegmentSchema = z
  .union([z.string().max(128), z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)])
  .refine((segment) => typeof segment !== 'string' || !FORBIDDEN_SEGMENTS.has(segment), {
    message: 'a patch cannot reach a prototype',
  });
const pathSchema = z.array(pathSegmentSchema).min(1).max(MAX_PATCH_PATH);

/** One Immer patch, as `applyDocumentPatches` takes it: with JSON values only, and no path through a prototype. */
export const patchSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('add'), path: pathSchema, value: jsonSchema }),
  z.strictObject({ op: z.literal('replace'), path: pathSchema, value: jsonSchema }),
  z.strictObject({ op: z.literal('remove'), path: pathSchema }),
]);

// --- Drag and drop -----------------------------------------------------------------------------

const componentTypeSchema = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/);
const slotNameSchema = z.string().regex(/^[a-z][a-zA-Z0-9]*$/);

/** What is being dragged, as `computeDropTarget` takes it. */
export const dragItemSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('component'), type: componentTypeSchema }),
  z.strictObject({
    kind: z.literal('template'),
    id: z.string().min(1).max(128),
    variant: z.string().min(1).max(64).optional(),
  }),
  z.strictObject({
    kind: z.literal('nodes'),
    ids: z.array(nodeIdSchema).min(1).max(MAX_SELECTION),
  }),
]);

/** Where a drop would land: a slot of a parent, and the gap among its current children. */
export const dropTargetSchema = z.strictObject({
  parentId: nodeIdSchema,
  slot: slotNameSchema,
  index: z.number().int().min(0).max(1_000_000),
});

/** Why a drop is refused, as a rule reports it (`Reason`): shown to the person dragging. */
const reasonSchema = z.strictObject({
  code: z.string().min(1).max(64),
  message: z.string().max(500),
  params: z.record(z.string().max(64), jsonSchema).optional(),
});

// --- Diagnostics -------------------------------------------------------------------------------

const diagnosticSchema = z.strictObject({
  code: z.string().min(1).max(128),
  message: z.string().max(2000),
  severity: z.enum(['error', 'warning']),
  path: z
    .array(z.union([z.string().max(128), z.number().int()]))
    .max(32)
    .optional(),
  details: z.record(z.string().max(64), jsonSchema).optional(),
});

// --- The messages ------------------------------------------------------------------------------

function message<T extends string, P extends z.ZodType>(type: T, payload: P) {
  return z.strictObject({ ...envelopeShape, type: z.literal(type), payload });
}

const empty = z.strictObject({});

/** A click, hover or double click: the node (a hover that leaves every node names none), the Loop repetition it was in, and the keys held. */
function pointerPayload<I extends z.ZodType>(id: I) {
  return z.strictObject({
    id,
    instance: z.string().min(1).max(200).optional(),
    modifiers: modifiersSchema,
  });
}
const idPayload = z.strictObject({ id: nodeIdSchema });

/** Messages the editor sends to the canvas. */
export const editorMessages = [
  message(
    'editor:init',
    z.strictObject({
      doc: documentSchema,
      docVersion: versionSchema,
      selection: z.array(nodeIdSchema).max(MAX_SELECTION),
      viewport: viewportSchema,
      contextRef: contextRefSchema,
      locale: localeSchema,
      locales: localesSchema,
      mode: modeSchema,
    }),
  ),
  message(
    'doc:patch',
    z
      .strictObject({
        from: versionSchema,
        to: versionSchema,
        patches: z.array(patchSchema).max(MAX_PATCHES),
      })
      .refine((payload) => payload.to > payload.from, {
        message: 'a patch must lead to a later version',
        path: ['to'],
      }),
  ),
  message('doc:set', z.strictObject({ doc: documentSchema, docVersion: versionSchema })),
  message('selection:set', z.strictObject({ ids: z.array(nodeIdSchema).max(MAX_SELECTION) })),
  message('hover:set', z.strictObject({ id: nodeIdSchema.nullable() })),
  message('viewport:set', viewportSchema),
  message('context:set', z.strictObject({ contextRef: contextRefSchema })),
  message('locale:set', z.strictObject({ locale: localeSchema })),
  message('dnd:over', z.strictObject({ point: pointSchema, item: dragItemSchema })),
  message('dnd:leave', empty),
  message('scroll:to', idPayload),
  message('mode:set', z.strictObject({ mode: modeSchema })),
] as const;

/** Messages the canvas sends to the editor. */
export const canvasMessages = [
  message(
    'canvas:hello',
    z.strictObject({
      protocol: z.number().int().min(1).max(1_000_000),
      rendererVersion: z.string().min(1).max(64),
      manifestHash: z.string().min(1).max(128),
    }),
  ),
  message('canvas:ready', empty),
  message('doc:resync-request', z.strictObject({ have: versionSchema })),
  message('node:click', pointerPayload(nodeIdSchema)),
  message('node:hover', pointerPayload(nodeIdSchema.nullable())),
  message('node:dblclick', pointerPayload(nodeIdSchema)),
  message(
    'inline:commit',
    z.strictObject({
      id: nodeIdSchema,
      prop: z
        .string()
        .regex(PROP_NAME)
        .refine((name) => !FORBIDDEN_SEGMENTS.has(name), { message: 'not a prop name' }),
      value: z.string().max(MAX_INLINE_TEXT),
    }),
  ),
  message(
    'dnd:target',
    z.strictObject({ target: dropTargetSchema.nullable(), reason: reasonSchema.optional() }),
  ),
  message(
    'intent:move',
    z.strictObject({
      ids: z.array(nodeIdSchema).min(1).max(MAX_SELECTION),
      target: dropTargetSchema,
    }),
  ),
  message(
    'key:down',
    z.strictObject({
      key: z.string().min(1).max(32),
      code: z.string().min(1).max(32),
      mods: modifiersSchema,
    }),
  ),
  message('contextmenu', z.strictObject({ id: nodeIdSchema.nullable(), point: pointSchema })),
  message('diagnostics', z.strictObject({ items: z.array(diagnosticSchema).max(MAX_DIAGNOSTICS) })),
  message(
    'canvas:error',
    z.strictObject({
      message: z.string().max(2000),
      nodeId: nodeIdSchema.optional(),
      fatal: z.boolean(),
    }),
  ),
] as const;
