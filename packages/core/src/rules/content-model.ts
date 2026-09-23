import type { ComponentType } from '../document/types.ts';
import type { ContentCategory } from '../registry/matchers.ts';
import { type Reason, reason } from './reasons.ts';

/** The bits of a node `checkGlobalContentModel` needs — its type and its declared categories. */
export interface ContentModelNode {
  readonly type: ComponentType;
  readonly categories: readonly ContentCategory[];
}

/**
 * The one component type these global rules know by name rather than by content category — see
 * the module doc comment below for why "form" isn't one of `CONTENT_CATEGORIES`.
 */
const FORM_COMPONENT_TYPE: ComponentType = 'buildr/form';

/**
 * The fixed HTML-content-model rules every registry gets for free, on top of each component's own
 * declared `parents`/`slots` rules (docs/component-registry.md#content-model-and-nesting-rules):
 * a heading only accepts phrasing content; interactive content cannot nest interactive content;
 * a form cannot nest a form; a form control requires a form ancestor. "Form" is matched by exact
 * type rather than a `#form` content category because nothing else needs that category — a
 * dedicated category would exist solely for this one rule.
 *
 * `ancestorChain` is nearest-first (the direct parent is `ancestorChain[0]`, the document root is
 * last) and does not include `child` itself.
 */
export function checkGlobalContentModel(
  ancestorChain: readonly ContentModelNode[],
  child: ContentModelNode,
): Reason | null {
  const parent = ancestorChain[0];

  if (parent?.categories.includes('heading') && !child.categories.includes('phrasing')) {
    return reason(
      'heading-requires-phrasing',
      `"${parent.type}" only accepts phrasing content, not "${child.type}".`,
      { parentType: parent.type, childType: child.type },
    );
  }

  if (child.categories.includes('interactive')) {
    const interactiveAncestor = ancestorChain.find((ancestor) =>
      ancestor.categories.includes('interactive'),
    );
    if (interactiveAncestor) {
      return reason(
        'nested-interactive',
        `"${child.type}" is interactive content and cannot be nested inside "${interactiveAncestor.type}", which is also interactive.`,
        { parentType: interactiveAncestor.type, childType: child.type },
      );
    }
  }

  if (child.type === FORM_COMPONENT_TYPE) {
    const formAncestor = ancestorChain.find((ancestor) => ancestor.type === FORM_COMPONENT_TYPE);
    if (formAncestor) {
      return reason('nested-form', 'A form cannot be nested inside another form.', {
        childType: child.type,
      });
    }
  }

  if (child.categories.includes('form-control')) {
    const hasFormAncestor = ancestorChain.some((ancestor) => ancestor.type === FORM_COMPONENT_TYPE);
    if (!hasFormAncestor) {
      return reason(
        'form-control-outside-form',
        `"${child.type}" is a form control and must be nested inside a form.`,
        { childType: child.type },
      );
    }
  }

  return null;
}
