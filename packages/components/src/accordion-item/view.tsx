import type { BuilderComponentProps } from '@buildr/react';
import type { accordionItemProps } from './props.ts';

/**
 * A `<details>`: the browser does the opening, the keyboard (Enter or Space on the summary) and the
 * accessibility semantics. Inside an accordion that does not allow several open items, all its items
 * get the same `name`, derived from the accordion's node id, so opening one closes the others.
 */
export function AccordionItemView({
  props,
  root,
  children,
  node,
}: BuilderComponentProps<typeof accordionItemProps>) {
  const parent = node.parent;
  const exclusive = parent?.type === 'buildr/accordion' && parent.props['allowMultiple'] === false;
  return (
    <details
      {...root}
      {...(props.defaultOpen ? { open: true } : {})}
      {...(exclusive ? { name: `bc-accordion-${parent?.id}` } : {})}
    >
      <summary className="bc-accordion-item__summary">{props.summary}</summary>
      <div className="bc-accordion-item__content">{children}</div>
    </details>
  );
}
