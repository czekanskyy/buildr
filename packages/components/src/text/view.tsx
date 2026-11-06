import { authorCodeEnabled, type HostCapabilities, sanitizeHtml } from '@next-buildr/core';
import type { BuilderComponentProps } from '@next-buildr/react';
import { renderRichText } from '@next-buildr/react';
import { createElement } from 'react';
import { renderHtmlNodes } from './html-nodes.tsx';
import { TEXT_ELEMENTS, type textProps } from './props.ts';

const ELEMENTS: readonly string[] = TEXT_ELEMENTS;

/** The host's capabilities as the renderer passes them in `env`; absent means none (fail closed). */
function capabilitiesOf(env: unknown): HostCapabilities | undefined {
  if (typeof env !== 'object' || env === null) return undefined;
  const value = (env as { capabilities?: unknown }).capabilities;
  return typeof value === 'object' && value !== null ? (value as HostCapabilities) : undefined;
}

/**
 * Plain text keeps its line breaks (`white-space: pre-line` in the CSS) and is never HTML. `rich`
 * walks a rich text value, and `html` renders core's sanitised tree (ADR-026) only when the host
 * allows author code; otherwise it shows the plain `text`. Rich and HTML content can hold blocks,
 * so those two modes render a `div` whatever `as` says.
 */
export function TextView({ props, root, platform, env }: BuilderComponentProps<typeof textProps>) {
  const requested = String(props.as);
  const element = ELEMENTS.includes(requested) ? requested : 'p';
  const mode = String(props.mode);

  if (mode === 'rich') {
    return createElement('div', root, renderRichText(props.rich, { platform }));
  }
  if (mode === 'html' && authorCodeEnabled(capabilitiesOf(env))) {
    return createElement('div', root, renderHtmlNodes(sanitizeHtml(props.html).nodes));
  }
  return createElement(element, root, props.text);
}
