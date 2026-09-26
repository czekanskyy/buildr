import type { ComponentMeta, Matcher, RegistryMeta } from '@next-buildr/core';
import { matchesType } from '@next-buildr/core';

// Answers "what can go where" from the registry, mirroring the placement rules of core's
// `canInsert` (slot allow/deny, the child's own parent rules, insertable/root). Only used to
// *describe* the rules and to suggest alternatives; the commands remain the authority.

function verdict(
  allow: readonly Matcher[] | undefined,
  deny: readonly Matcher[] | undefined,
  meta: ComponentMeta,
): boolean {
  if (deny?.some((m) => matchesType(m, meta.type, meta.contentCategories))) return false;
  if (allow && allow.length > 0) {
    return allow.some((m) => matchesType(m, meta.type, meta.contentCategories));
  }
  return true;
}

/**
 * Whether `child` may directly sit in `slot` of `parent`, judging by the two components alone.
 * `enforceInsertable: false` also accepts components that cannot be inserted on their own
 * (`insertable: false`, such as list items) but may appear inside a tree that is inserted.
 */
export function acceptsChild(
  parent: ComponentMeta,
  slot: string,
  child: ComponentMeta,
  enforceInsertable = true,
): boolean {
  const slotDef = parent.slots?.[slot];
  if (!slotDef) return false;
  if (child.capabilities?.root) return false;
  if (enforceInsertable && child.capabilities?.insertable === false) return false;
  if (!verdict(slotDef.allow, slotDef.deny, child)) return false;
  const rules = child.parents;
  if (!rules) return true;
  return verdict(rules.allow, rules.deny, parent);
}

/** The component types that may directly sit in `slot` of `parentType`, in registry order. */
export function allowedChildTypes(
  registry: RegistryMeta,
  parentType: string,
  slot: string,
  enforceInsertable = true,
): string[] {
  const parent = registry.get(parentType);
  if (!parent) return [];
  return registry
    .list()
    .filter((child) => acceptsChild(parent, slot, child, enforceInsertable))
    .map((child) => child.type);
}

/** Every `{ type, slot }` a `childType` may directly sit in, in registry order. */
export function allowedParents(
  registry: RegistryMeta,
  childType: string,
  enforceInsertable = true,
): { readonly type: string; readonly slot: string }[] {
  const child = registry.get(childType);
  if (!child) return [];
  const result: { type: string; slot: string }[] = [];
  for (const parent of registry.list()) {
    for (const slot of Object.keys(parent.slots ?? {})) {
      if (acceptsChild(parent, slot, child, enforceInsertable))
        result.push({ type: parent.type, slot });
    }
  }
  return result;
}

/** The concrete component types a matcher list stands for (categories expanded). */
export function expandMatchers(registry: RegistryMeta, matchers: readonly Matcher[]): string[] {
  return registry
    .list()
    .filter((meta) => matchers.some((m) => matchesType(m, meta.type, meta.contentCategories)))
    .map((meta) => meta.type);
}
