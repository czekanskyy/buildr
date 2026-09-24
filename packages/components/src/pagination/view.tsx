import { sanitizeUrl } from '@buildr/core';
import type { BuilderComponentProps } from '@buildr/react';
import { createElement, type ReactNode } from 'react';
import { message } from '../messages/index.ts';
import { clampInt, pageItems } from './pages.ts';
import type { paginationProps } from './props.ts';

const MAX_PAGES = 10_000;

/** The URL of page `n`, or nothing if the pattern does not give a safe one. */
function hrefFor(pattern: string, n: number): string | undefined {
  const url = sanitizeUrl(pattern.split('{page}').join(String(n)));
  return url.ok && url.value !== '' ? url.value : undefined;
}

export function PaginationView({
  props,
  root,
  platform,
  env,
}: BuilderComponentProps<typeof paginationProps>) {
  const total = clampInt(props.totalPages, 0, MAX_PAGES, 1);
  // One page needs no navigation. The editor's canvas still shows it, so it can be selected.
  if (total <= 1 && env.mode !== 'canvas') return null;
  const current = clampInt(props.page, 1, Math.max(total, 1), 1);
  const label = props.ariaLabel !== '' ? props.ariaLabel : message(env, 'pagination.label');
  const Link = platform?.Link;

  const link = (n: number, name: string, children: ReactNode, currentPage = false) => {
    const href = hrefFor(props.hrefPattern, n);
    if (href === undefined) {
      return createElement(
        'span',
        { className: 'bc-pagination__item', 'aria-label': name },
        children,
      );
    }
    const attributes = {
      className: 'bc-pagination__item',
      href,
      'aria-label': name,
      ...(currentPage ? { 'aria-current': 'page' as const } : {}),
    };
    return createElement(Link ?? 'a', attributes, children);
  };

  const items: ReactNode[] = [];
  if (current > 1) {
    items.push(<li key="prev">{link(current - 1, message(env, 'pagination.previous'), '‹')}</li>);
  }
  for (const item of pageItems(current, total)) {
    if (item.kind === 'gap') {
      items.push(
        <li key={`gap-${items.length}`} aria-hidden="true" className="bc-pagination__gap">
          …
        </li>,
      );
    } else {
      items.push(
        <li key={item.page}>
          {link(
            item.page,
            message(env, 'pagination.page').replace('{page}', String(item.page)),
            String(item.page),
            item.page === current,
          )}
        </li>,
      );
    }
  }
  if (current < total) {
    items.push(<li key="next">{link(current + 1, message(env, 'pagination.next'), '›')}</li>);
  }

  return (
    <nav {...root} aria-label={label}>
      <ul className="bc-pagination__list">{items}</ul>
    </nav>
  );
}
