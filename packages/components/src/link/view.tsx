import type { BuilderComponentProps } from '@next-buildr/react';
import { createElement } from 'react';
import { linkAttributes, newTabNotice } from '../link-attributes.ts';
import type { linkProps } from './props.ts';

/**
 * The URL was sanitized when the prop was resolved; an unsafe one arrives as the default (`#`), so
 * the worst case is a link to the top of the page, never a script.
 */
export function LinkView({ props, root, platform, env }: BuilderComponentProps<typeof linkProps>) {
  const notice = newTabNotice(props.newTab, props.ariaLabel, env);
  const attributes = {
    ...root,
    ...linkAttributes(props.newTab, props.ariaLabel, env),
    href: props.href,
  };
  const children = [
    props.label,
    notice !== undefined ? (
      <span key="notice" className="bc-visually-hidden">
        {notice}
      </span>
    ) : null,
  ];
  return platform !== undefined
    ? createElement(platform.Link, attributes, children)
    : createElement('a', attributes, children);
}
