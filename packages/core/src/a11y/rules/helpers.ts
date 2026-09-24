import type { PageNode } from '../../document/types.ts';
import type { A11yContext, A11yFix, A11yIssue, A11yRule } from '../types.ts';

export function issue(
  rule: Pick<A11yRule, 'id' | 'severity' | 'perLocale'>,
  ctx: A11yContext,
  node: PageNode,
  message: string,
  extra: { help?: string; fix?: A11yFix; severity?: A11yIssue['severity'] } = {},
): A11yIssue {
  return {
    ruleId: rule.id,
    severity: extra.severity ?? rule.severity,
    nodeId: node.id,
    message,
    ...(extra.help !== undefined ? { help: extra.help } : {}),
    ...(extra.fix !== undefined ? { fix: extra.fix } : {}),
    ...(rule.perLocale ? { locale: ctx.locale } : {}),
  };
}

export const isBlank = (text: string): boolean => text.trim() === '';

/**
 * Whether a node has an accessible name from the given text props: `named`, `unnamed`, or
 * `unknown` when a prop it would come from is bound to data. A prop the component does not declare
 * is not a source of a name.
 */
export function accessibleName(
  ctx: A11yContext,
  node: PageNode,
  props: readonly string[],
): 'named' | 'unnamed' | 'unknown' {
  const declared = ctx.meta(node)?.props ?? {};
  let unknown = false;
  for (const prop of props) {
    if (!Object.hasOwn(declared, prop)) continue;
    const value = ctx.text(node, prop);
    if (!value.known) unknown = true;
    else if (!isBlank(value.value)) return 'named';
  }
  if (unknown) return 'unknown';
  // Children (an icon and a visually hidden text, say) can name it; they are not judged here.
  return ctx.children(node).length > 0 ? 'unknown' : 'unnamed';
}

/** A `node.setProp` command writing a static value — the shape `commands` accepts, without importing it. */
export function setPropFix(nodeId: string, prop: string, value: unknown): A11yFix {
  return { type: 'node.setProp', payload: { id: nodeId, prop, value: { kind: 'static', value } } };
}
