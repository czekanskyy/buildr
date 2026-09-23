import { z } from 'zod';
import { ANCHOR_PATTERN, COMPONENT_TYPE_PATTERN, SLOT_NAME_PATTERN } from '../document/schema.ts';
import type { ComponentType } from '../document/types.ts';
import { hash } from '../json/hash.ts';
import type { JsonValue } from '../json/json-value.ts';
import { isJsonValue } from '../json/json-value.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import { CONTENT_CATEGORIES, isValidContentCategory } from './matchers.ts';
import type { ComponentMeta } from './meta.ts';
import type { RegistryMeta, TemplateDefinition } from './registry.ts';

const STYLE_GROUP_IDS = [
  'layout',
  'size',
  'spacing',
  'typography',
  'background',
  'border',
  'effects',
  'visibility',
] as const;

/**
 * The JSON projection of a `RegistryMeta` (ADR-003) — everything the editor's palette, inspector
 * and drag-and-drop rules need, with no functions attached. `toManifest`/`manifestHash` produce
 * one; `fromManifest` validates one arriving over an untrusted boundary (postMessage, HTTP —
 * docs/ai/architecture-rules.md #7).
 */
export interface RegistryManifest {
  readonly hash: string;
  readonly components: Readonly<Record<ComponentType, ComponentMeta>>;
  readonly templates: Readonly<Record<string, TemplateDefinition>>;
}

function toRecord<T>(items: readonly T[], keyOf: (item: T) => string): Record<string, T> {
  return Object.fromEntries(items.map((item) => [keyOf(item), item]));
}

function manifestContent(
  registry: RegistryMeta,
): Pick<RegistryManifest, 'components' | 'templates'> {
  return {
    components: toRecord(registry.list(), (meta) => meta.type),
    templates: toRecord(registry.listTemplates(), (template) => template.id),
  };
}

/**
 * A stable hash of `registry`'s components and templates — deterministic (independent of
 * registration order) and sensitive to any metadata change. Used both to fill `toManifest`'s own
 * `hash` field and, on the canvas side, to report `canvas:hello { manifestHash }` without having
 * to materialize a full manifest (docs/editor.md#handshake).
 */
export function manifestHash(registry: RegistryMeta): string {
  const content = manifestContent(registry);
  // `ComponentMeta`/`TemplateDefinition` are fully JSON-serializable by construction (ADR-003) —
  // no live function ever reaches them — so this cast is safe.
  return hash(content as unknown as JsonValue);
}

/** Projects `registry` into a `RegistryManifest` — the JSON sent to the editor (ADR-003). */
export function toManifest(registry: RegistryMeta): RegistryManifest {
  return { hash: manifestHash(registry), ...manifestContent(registry) };
}

const componentTypeSchema = z.string().regex(COMPONENT_TYPE_PATTERN);
const slotNameSchema = z.string().regex(SLOT_NAME_PATTERN);
const anchorSchema = z.string().regex(ANCHOR_PATTERN);
const jsonValueSchema = z.custom<JsonValue>(isJsonValue, { message: 'must be a JSON value' });
const contentCategorySchema = z.enum(CONTENT_CATEGORIES);
const styleGroupIdSchema = z.enum(STYLE_GROUP_IDS);

const matcherSchema = z
  .string()
  .refine(
    (value) =>
      value.startsWith('#')
        ? isValidContentCategory(value.slice(1))
        : COMPONENT_TYPE_PATTERN.test(value),
    { message: 'must be a component type ("ns/name") or a "#category" matcher' },
  );

const dataTypeTagSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'url',
  'richText',
  'media',
  'link',
  'enum',
  'object',
  'list',
  'ref',
]);

const commonPropShape = {
  label: z.string().optional(),
  group: z.string().optional(),
  bindable: z.boolean().optional(),
  required: z.boolean().optional(),
  localizable: z.boolean(),
  accepts: z.array(dataTypeTagSchema),
};

// Not typed `z.ZodType<PropDef>`: `select`'s `options`/`default` widen from `PropDef`'s nonempty
// tuple to a plain array under Zod's inference, so callers cast the parsed result instead (like
// `documentSchema`'s `PageNode` — see `document/parse.ts`).
const propDefSchema: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('text'),
      ...commonPropShape,
      default: z.string(),
      maxLength: z.number().optional(),
    }),
    z.strictObject({
      kind: z.literal('textarea'),
      ...commonPropShape,
      default: z.string(),
      maxLength: z.number().optional(),
    }),
    z.strictObject({ kind: z.literal('richText'), ...commonPropShape, default: jsonValueSchema }),
    z.strictObject({
      kind: z.literal('number'),
      ...commonPropShape,
      default: z.number(),
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().optional(),
    }),
    z.strictObject({ kind: z.literal('boolean'), ...commonPropShape, default: z.boolean() }),
    z.strictObject({
      kind: z.literal('select'),
      ...commonPropShape,
      options: z.array(z.union([z.string(), z.number()])).min(1),
      default: z.union([z.string(), z.number()]),
    }),
    z.strictObject({ kind: z.literal('link'), ...commonPropShape, default: z.string() }),
    z.strictObject({
      kind: z.literal('media'),
      ...commonPropShape,
      default: jsonValueSchema,
      accept: z.array(z.string()).optional(),
    }),
    z.strictObject({ kind: z.literal('icon'), ...commonPropShape, default: z.string() }),
    z.strictObject({
      kind: z.literal('list'),
      ...commonPropShape,
      of: propDefSchema,
      default: z.array(z.unknown()),
      min: z.number().optional(),
      max: z.number().optional(),
    }),
    z.strictObject({
      kind: z.literal('object'),
      ...commonPropShape,
      fields: z.record(z.string(), propDefSchema),
      default: z.record(z.string(), z.unknown()),
    }),
    z.strictObject({
      kind: z.literal('listSource'),
      ...commonPropShape,
      default: jsonValueSchema,
      accept: z.array(z.string()).optional(),
    }),
  ]),
);

const treeNodeLockSchema = z.strictObject({
  structure: z.literal(true).optional(),
  content: z.literal(true).optional(),
  style: z.literal(true).optional(),
});

// The nested authoring shape (`TreeNode`, `document/tree.ts`) redefined here for boundary
// validation — `document/tree.ts` itself carries no schema since it is never parsed from
// untrusted JSON on its own; a `TemplateDefinition` crossing the manifest boundary is the first
// place one needs to be.
const treeNodeSchema: z.ZodTypeAny = z.lazy(() =>
  z.strictObject({
    type: componentTypeSchema,
    props: z.record(z.string(), z.unknown()).optional(),
    styles: z.unknown().optional(),
    children: z.array(treeNodeSchema).optional(),
    slots: z.record(slotNameSchema, z.array(treeNodeSchema)).optional(),
    name: z.string().optional(),
    anchor: anchorSchema.optional(),
    lock: treeNodeLockSchema.optional(),
    region: z.string().optional(),
  }),
);

const slotDefSchema = z.strictObject({
  label: z.string().optional(),
  allow: z.array(matcherSchema).optional(),
  deny: z.array(matcherSchema).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  axis: z.enum(['vertical', 'horizontal', 'auto']).optional(),
});

const parentRulesSchema = z.strictObject({
  allow: z.array(matcherSchema).optional(),
  deny: z.array(matcherSchema).optional(),
  requireAncestor: z.array(matcherSchema).optional(),
});

const capabilitiesSchema = z.strictObject({
  insertable: z.boolean().optional(),
  draggable: z.boolean().optional(),
  removable: z.boolean().optional(),
  duplicable: z.boolean().optional(),
  root: z.boolean().optional(),
});

const a11yMetaSchema = z.strictObject({
  element: z.string(),
  role: z.string().optional(),
  landmark: z.boolean().optional(),
  requiresName: z.boolean().optional(),
  rules: z.array(z.string()).optional(),
});

const editorMetaSchema = z.strictObject({
  inlineProp: z.string().optional(),
  placeholder: z.string().optional(),
  revealOnSelect: z.boolean().optional(),
  emptySlotText: z.record(slotNameSchema, z.string()).optional(),
});

const formFieldMetaSchema = z.strictObject({
  valueType: z.enum(['string', 'email', 'tel', 'url', 'number', 'boolean', 'enum']),
  nameProp: z.string(),
  requiredProp: z.string().optional(),
  maxLengthProp: z.string().optional(),
  optionsProp: z.string().optional(),
});

const componentMetaSchema = z.strictObject({
  type: componentTypeSchema,
  version: z.number().int().min(1),
  label: z.string(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  category: z.string(),
  icon: z.string().optional(),
  props: z.record(z.string(), propDefSchema),
  slots: z.record(slotNameSchema, slotDefSchema).optional(),
  contentCategories: z.array(contentCategorySchema),
  parents: parentRulesSchema.optional(),
  capabilities: capabilitiesSchema.optional(),
  styles: z.strictObject({ groups: z.array(styleGroupIdSchema) }),
  a11y: a11yMetaSchema.optional(),
  editor: editorMetaSchema.optional(),
  formField: formFieldMetaSchema.optional(),
  defaults: z
    .strictObject({ slots: z.record(slotNameSchema, z.array(treeNodeSchema)).optional() })
    .optional(),
  runtime: z.enum(['shared', 'client']),
});

const templateDefinitionSchema = z.strictObject({
  id: z.string(),
  version: z.number().int().min(1),
  label: z.string(),
  category: z.string(),
  thumbnail: z.string().optional(),
  lock: z.enum(['none', 'structure']),
  variants: z.record(z.string(), treeNodeSchema).optional(),
  tree: treeNodeSchema,
});

/** Validates an untrusted `RegistryManifest` shape only — see `document/schema.ts`'s own scope note. */
export const registryManifestSchema = z.strictObject({
  hash: z.string(),
  components: z.record(componentTypeSchema, componentMetaSchema),
  templates: z.record(z.string(), templateDefinitionSchema),
});

function issueToDiagnostic(issue: z.ZodIssue): Diagnostic {
  const path = issue.path.filter(
    (segment): segment is string | number => typeof segment !== 'symbol',
  );
  return { code: 'manifest.invalid-shape', message: issue.message, severity: 'error', path };
}

/**
 * Parses and validates an untrusted value into a `RegistryManifest` (docs/ai/architecture-rules.md
 * #7) — for a manifest arriving over `postMessage` or fetched from a server. Format only, like
 * `parseDocument`; never throws for bad data.
 */
export function fromManifest(input: unknown): Result<RegistryManifest, Diagnostic[]> {
  const parsed = registryManifestSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues.map(issueToDiagnostic));
  return ok(parsed.data as unknown as RegistryManifest);
}
