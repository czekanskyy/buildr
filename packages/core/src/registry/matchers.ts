import type { ComponentType } from '../document/types.ts';

/**
 * The HTML-content-model categories a component can advertise via
 * `ComponentMeta.contentCategories` (docs/component-registry.md#content-model-and-nesting-rules).
 * A `Matcher` targets a whole class of components by prefixing one of these with `#` instead of
 * naming an exact type.
 */
export const CONTENT_CATEGORIES = [
  'flow',
  'phrasing',
  'heading',
  'interactive',
  'form-control',
  'list-item',
  'landmark',
  'media',
] as const satisfies readonly string[];

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

/**
 * A `parents.allow`/`deny`/`requireAncestor` or `SlotDef.allow`/`deny` entry: either an exact
 * component `type` (`"buildr/heading"`) or a content category (`"#heading"`) — see
 * docs/component-registry.md#content-model-and-nesting-rules. Structurally just a `string` (like
 * `ComponentType`); `isCategoryMatcher` is what tells the two apart at runtime.
 */
export type Matcher = ComponentType | `#${ContentCategory}`;

/** Whether `matcher` is a `#category` matcher rather than an exact component type. */
export function isCategoryMatcher(matcher: Matcher): matcher is `#${ContentCategory}` {
  return matcher.startsWith('#');
}

/** The category name inside a category matcher, e.g. `"heading"` for `"#heading"`. */
export function categoryOf(matcher: `#${string}`): string {
  return matcher.slice(1);
}

export function isValidContentCategory(value: string): value is ContentCategory {
  return (CONTENT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Whether `matcher` targets `type`: directly (an exact-type matcher), or through one of the
 * type's own `contentCategories` (a category matcher) — see
 * docs/component-registry.md#content-model-and-nesting-rules. The one piece of matching logic
 * every consumer of `Matcher` shares, including `canInsert`/`canMove` (PB-016).
 */
export function matchesType(
  matcher: Matcher,
  type: ComponentType,
  contentCategories: readonly ContentCategory[],
): boolean {
  if (isCategoryMatcher(matcher)) {
    return contentCategories.includes(categoryOf(matcher) as ContentCategory);
  }
  return matcher === type;
}
