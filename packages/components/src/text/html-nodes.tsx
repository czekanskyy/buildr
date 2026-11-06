import type { HtmlNode } from '@next-buildr/core';
import { createElement, type ReactNode } from 'react';

/**
 * Turns the output of core's HTML sanitiser (ADR-026) into React elements. The nodes are already an
 * allowlisted tree of text and elements with allowlisted attributes, and they are built here with
 * `createElement`, so the text is escaped by React and no HTML string is ever injected: there is no
 * `dangerouslySetInnerHTML` in this package.
 */
export function renderHtmlNodes(nodes: readonly HtmlNode[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.kind === 'text') return node.text;
    return createElement(
      node.tag,
      { key: index, ...node.attrs },
      ...(node.children.length > 0 ? [renderHtmlNodes(node.children)] : []),
    );
  });
}
