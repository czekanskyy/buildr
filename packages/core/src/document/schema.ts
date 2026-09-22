import { z } from 'zod';
import { isJsonValue, type JsonValue } from '../json/json-value.ts';

/** A random, base62, 10-character node ID minted by `generateId` — excludes the literal `root`. */
export const RANDOM_NODE_ID_PATTERN = /^[A-Za-z0-9]{10}$/;
export const COMPONENT_TYPE_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+$/;
export const SLOT_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
export const ANCHOR_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

const randomNodeIdSchema = z.string().regex(RANDOM_NODE_ID_PATTERN);
/** Any valid node ID, including the fixed `root` id (see docs/document-model.md). */
const nodeIdSchema = z.union([z.literal('root'), randomNodeIdSchema]);
/** A node ID as it appears inside a slot's child list — `root` can never be a child. */
const childNodeIdSchema = randomNodeIdSchema;
const componentTypeSchema = z.string().regex(COMPONENT_TYPE_PATTERN);
const slotNameSchema = z.string().regex(SLOT_NAME_PATTERN);
const anchorSchema = z.string().regex(ANCHOR_PATTERN);

const jsonValueSchema = z.custom<JsonValue>(isJsonValue, { message: 'must be a JSON value' });

const lockSchema = z.strictObject({
  structure: z.literal(true).optional(),
  content: z.literal(true).optional(),
  style: z.literal(true).optional(),
});

const sourceSchema = z.strictObject({
  template: z.string(),
  version: z.number().int().min(1),
});

const metaSchema = z.strictObject({
  createdWith: z.string().optional(),
  updatedWith: z.string().optional(),
});

/** A single node in the normalized document tree (see docs/document-model.md). */
export const pageNodeSchema = z.strictObject({
  id: nodeIdSchema,
  type: componentTypeSchema,
  props: z.record(z.string(), z.unknown()).optional(),
  slots: z.record(slotNameSchema, z.array(childNodeIdSchema)).optional(),
  styles: z.unknown().optional(),
  name: z.string().optional(),
  anchor: anchorSchema.optional(),
  visibleIf: z.unknown().optional(),
  lock: lockSchema.optional(),
  region: z.string().optional(),
  source: sourceSchema.optional(),
  ext: z.record(z.string(), jsonValueSchema).optional(),
});

/**
 * The canonical document envelope. Validates shape and format only — cross-node invariants
 * (cycles, orphans, a node's map key matching its `id`) are `checkInvariants`'s job (PB-009).
 */
export const documentSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    root: z.literal('root'),
    nodes: z.record(nodeIdSchema, pageNodeSchema),
    components: z.record(componentTypeSchema, z.number().int().min(1)),
    meta: metaSchema.optional(),
  })
  .superRefine((doc, ctx) => {
    if (!Object.hasOwn(doc.nodes, 'root')) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: 'the document is missing its root node',
        params: { code: 'document.missing-root-node' },
      });
    }
  });
