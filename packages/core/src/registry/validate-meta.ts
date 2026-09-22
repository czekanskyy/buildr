import type { Diagnostic } from '../result/diagnostic.ts';
import { validatePropValue } from '../schema/validate.ts';
import { categoryOf, isCategoryMatcher, isValidContentCategory, type Matcher } from './matchers.ts';
import type { ComponentMeta, SlotDef } from './meta.ts';

/** `<namespace>/<name>`, e.g. `"buildr/heading"`, `"acme/pricing-table"` (docs/document-model.md). */
const TYPE_SHAPE = /^[a-z0-9-]+\/[a-z0-9-]+$/;

/** A slot name, e.g. `"default"`, `"actions"` (docs/document-model.md). */
const SLOT_NAME_SHAPE = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Checks a `ComponentMeta` for the semantic invariants a Zod shape check alone can't express
 * (docs/component-registry.md, PB-014 backlog card): the `type` and slot names are well-formed,
 * every prop's `default` passes that prop's own validator, slots are internally consistent, and
 * every `Matcher` used anywhere in the metadata is a well-formed type reference or a recognized
 * content category. Pure and non-throwing (docs/ai/architecture-rules.md #7) — an invalid
 * `ComponentMeta` is an authoring mistake, not a document to reject, so this is meant to be called
 * at registry-construction time (`createRegistryMeta`, PB-015) and surfaced to the author, not to
 * end users.
 */
export function validateComponentMeta(meta: ComponentMeta): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  checkType(meta, diagnostics);
  checkVersion(meta, diagnostics);
  checkPropDefaults(meta, diagnostics);
  checkSlotConsistency(meta, diagnostics);
  checkCategoryConsistency(meta, diagnostics);

  return diagnostics;
}

function checkType(meta: ComponentMeta, diagnostics: Diagnostic[]): void {
  if (TYPE_SHAPE.test(meta.type)) return;
  diagnostics.push({
    code: 'component.invalid-type',
    message: `component type "${meta.type}" must look like "<namespace>/<name>" (lowercase letters, digits, hyphens)`,
    severity: 'error',
    path: ['type'],
    details: { type: meta.type },
  });
}

function checkVersion(meta: ComponentMeta, diagnostics: Diagnostic[]): void {
  if (Number.isInteger(meta.version) && meta.version >= 1) return;
  diagnostics.push({
    code: 'component.invalid-version',
    message: `component "${meta.type}" has version ${meta.version}, expected an integer >= 1`,
    severity: 'error',
    path: ['version'],
    details: { type: meta.type, version: meta.version },
  });
}

function checkPropDefaults(meta: ComponentMeta, diagnostics: Diagnostic[]): void {
  for (const [propName, propDef] of Object.entries(meta.props)) {
    const result = validatePropValue(propDef, propDef.default);
    if (result.ok) continue;
    diagnostics.push({
      code: 'component.invalid-prop-default',
      message: `component "${meta.type}" prop "${propName}" has a default value that fails its own "${propDef.kind}" validator: ${result.error.message}`,
      severity: 'error',
      path: ['props', propName, 'default'],
      details: { type: meta.type, prop: propName, kind: propDef.kind },
    });
  }
}

function checkSlotConsistency(meta: ComponentMeta, diagnostics: Diagnostic[]): void {
  const slotNames = new Set(Object.keys(meta.slots ?? {}));

  for (const [slotName, slotDef] of Object.entries(meta.slots ?? {})) {
    checkSlotName(meta, slotName, diagnostics);
    checkSlotRange(meta, slotName, slotDef, diagnostics);
  }

  checkSlotReferences(meta, slotNames, meta.defaults?.slots, 'defaults.slots', diagnostics);
  checkSlotReferences(
    meta,
    slotNames,
    meta.editor?.emptySlotText,
    'editor.emptySlotText',
    diagnostics,
  );
}

function checkSlotName(meta: ComponentMeta, slotName: string, diagnostics: Diagnostic[]): void {
  if (SLOT_NAME_SHAPE.test(slotName)) return;
  diagnostics.push({
    code: 'component.invalid-slot-name',
    message: `component "${meta.type}" has a slot named "${slotName}", which must start with a lowercase letter and contain only letters and digits`,
    severity: 'error',
    path: ['slots', slotName],
    details: { type: meta.type, slot: slotName },
  });
}

function checkSlotRange(
  meta: ComponentMeta,
  slotName: string,
  slotDef: SlotDef,
  diagnostics: Diagnostic[],
): void {
  const { min, max } = slotDef;
  if (min !== undefined && (!Number.isInteger(min) || min < 0)) {
    diagnostics.push({
      code: 'component.invalid-slot-range',
      message: `component "${meta.type}" slot "${slotName}" has min ${min}, expected an integer >= 0`,
      severity: 'error',
      path: ['slots', slotName, 'min'],
      details: { type: meta.type, slot: slotName, min },
    });
  }
  if (max !== undefined && (!Number.isInteger(max) || max < 0)) {
    diagnostics.push({
      code: 'component.invalid-slot-range',
      message: `component "${meta.type}" slot "${slotName}" has max ${max}, expected an integer >= 0`,
      severity: 'error',
      path: ['slots', slotName, 'max'],
      details: { type: meta.type, slot: slotName, max },
    });
  }
  if (min !== undefined && max !== undefined && min > max) {
    diagnostics.push({
      code: 'component.invalid-slot-range',
      message: `component "${meta.type}" slot "${slotName}" has min ${min} greater than max ${max}`,
      severity: 'error',
      path: ['slots', slotName],
      details: { type: meta.type, slot: slotName, min, max },
    });
  }
}

function checkSlotReferences(
  meta: ComponentMeta,
  declaredSlots: ReadonlySet<string>,
  referenced: Readonly<Record<string, unknown>> | undefined,
  source: string,
  diagnostics: Diagnostic[],
): void {
  if (!referenced) return;
  for (const slotName of Object.keys(referenced)) {
    if (declaredSlots.has(slotName)) continue;
    diagnostics.push({
      code: 'component.unknown-slot',
      message: `component "${meta.type}" ${source} references undeclared slot "${slotName}"`,
      severity: 'error',
      path: [...source.split('.'), slotName],
      details: { type: meta.type, slot: slotName, source },
    });
  }
}

function checkCategoryConsistency(meta: ComponentMeta, diagnostics: Diagnostic[]): void {
  if (meta.contentCategories.length === 0) {
    diagnostics.push({
      code: 'component.empty-content-categories',
      message: `component "${meta.type}" has no contentCategories — every component must belong to at least one HTML content-model category`,
      severity: 'error',
      path: ['contentCategories'],
      details: { type: meta.type },
    });
  }
  for (const category of meta.contentCategories) {
    if (isValidContentCategory(category)) continue;
    diagnostics.push({
      code: 'component.invalid-content-category',
      message: `component "${meta.type}" declares unknown content category "${category}"`,
      severity: 'error',
      path: ['contentCategories'],
      details: { type: meta.type, category },
    });
  }

  for (const [source, matchers] of matcherSources(meta)) {
    for (const matcher of matchers) checkMatcher(meta, source, matcher, diagnostics);
  }
}

function* matcherSources(meta: ComponentMeta): Generator<[string, readonly Matcher[]]> {
  if (meta.parents?.allow) yield ['parents.allow', meta.parents.allow];
  if (meta.parents?.deny) yield ['parents.deny', meta.parents.deny];
  if (meta.parents?.requireAncestor)
    yield ['parents.requireAncestor', meta.parents.requireAncestor];
  for (const [slotName, slotDef] of Object.entries(meta.slots ?? {})) {
    if (slotDef.allow) yield [`slots.${slotName}.allow`, slotDef.allow];
    if (slotDef.deny) yield [`slots.${slotName}.deny`, slotDef.deny];
  }
}

function checkMatcher(
  meta: ComponentMeta,
  source: string,
  matcher: Matcher,
  diagnostics: Diagnostic[],
): void {
  if (isCategoryMatcher(matcher)) {
    if (isValidContentCategory(categoryOf(matcher))) return;
    diagnostics.push({
      code: 'component.invalid-matcher',
      message: `component "${meta.type}" ${source} references unknown category matcher "${matcher}"`,
      severity: 'error',
      path: source.split('.'),
      details: { type: meta.type, source, matcher },
    });
    return;
  }
  if (TYPE_SHAPE.test(matcher)) return;
  diagnostics.push({
    code: 'component.invalid-matcher',
    message: `component "${meta.type}" ${source} references malformed type matcher "${matcher}"`,
    severity: 'error',
    path: source.split('.'),
    details: { type: meta.type, source, matcher },
  });
}
