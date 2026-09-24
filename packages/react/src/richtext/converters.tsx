import { type Diagnostic, sanitizeUrl } from '@buildr/core';
import { createElement, type ReactNode } from 'react';
import type { Platform } from '../define/types.ts';

/** A rich text node as it arrives: untrusted JSON, so every field is checked before it is used. */
export type RichTextJson = Readonly<Record<string, unknown>>;

/** What a converter may use: the platform's link, a way to report, and the walker for children. */
export interface RichTextConverterContext {
  readonly platform: Platform | undefined;
  /** Renders `nodes` (a node's `children`) with the same converters. */
  children(nodes: unknown, path: readonly (string | number)[]): ReactNode;
  report(diagnostic: Diagnostic): void;
  /** Where the node is in the tree, for diagnostics. */
  readonly path: readonly (string | number)[];
}

/** Turns one node type into React. Returns `null` to render nothing. Never throws for bad data. */
export type RichTextConverter = (node: RichTextJson, ctx: RichTextConverterContext) => ReactNode;

/** Node type to converter; `@buildr/payload` adds `upload`, `relationship`, … by passing its own. */
export type RichTextConverters = Readonly<Record<string, RichTextConverter>>;

/** Lexical's text format bitmask. */
export const TEXT_FORMAT = {
  bold: 1,
  italic: 2,
  strikethrough: 4,
  underline: 8,
  code: 16,
  subscript: 32,
  superscript: 64,
} as const;

/** Innermost first, so `bold + code` is `<strong><code>…</code></strong>`. */
const FORMAT_TAGS: readonly (readonly [number, string])[] = [
  [TEXT_FORMAT.code, 'code'],
  [TEXT_FORMAT.subscript, 'sub'],
  [TEXT_FORMAT.superscript, 'sup'],
  [TEXT_FORMAT.underline, 'u'],
  [TEXT_FORMAT.strikethrough, 's'],
  [TEXT_FORMAT.italic, 'em'],
  [TEXT_FORMAT.bold, 'strong'],
];

const HEADING_TAGS: ReadonlySet<string> = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function own(node: RichTextJson, key: string): unknown {
  return Object.hasOwn(node, key) ? node[key] : undefined;
}

const text: RichTextConverter = (node) => {
  const value = own(node, 'text');
  if (typeof value !== 'string') return null;
  const format = own(node, 'format');
  const bits = typeof format === 'number' && Number.isInteger(format) && format > 0 ? format : 0;
  let out: ReactNode = value;
  for (const [bit, tag] of FORMAT_TAGS) {
    if ((bits & bit) !== 0) out = createElement(tag, null, out);
  }
  return out;
};

const linebreak: RichTextConverter = () => createElement('br');

const paragraph: RichTextConverter = (node, ctx) =>
  createElement('p', null, ctx.children(own(node, 'children'), ctx.path));

const quote: RichTextConverter = (node, ctx) =>
  createElement('blockquote', null, ctx.children(own(node, 'children'), ctx.path));

const heading: RichTextConverter = (node, ctx) => {
  const tag = own(node, 'tag');
  if (typeof tag !== 'string' || !HEADING_TAGS.has(tag)) {
    ctx.report({
      code: 'richtext.invalid-node',
      message: 'a heading has no valid tag and was dropped',
      severity: 'warning',
      path: ctx.path,
    });
    return null;
  }
  return createElement(tag, null, ctx.children(own(node, 'children'), ctx.path));
};

const list: RichTextConverter = (node, ctx) => {
  const ordered = own(node, 'listType') === 'number';
  return createElement(ordered ? 'ol' : 'ul', null, ctx.children(own(node, 'children'), ctx.path));
};

const listitem: RichTextConverter = (node, ctx) =>
  createElement('li', null, ctx.children(own(node, 'children'), ctx.path));

/**
 * A link is routed through `platform.Link` (so internal paths get the framework's router) after its
 * URL is checked again — the value may not have come through core's normalization. A URL that is
 * missing, empty or not on the scheme allowlist leaves the link's text without the link.
 */
const link: RichTextConverter = (node, ctx) => {
  const inner = ctx.children(own(node, 'children'), ctx.path);
  const raw = own(node, 'url');
  if (typeof raw !== 'string' || raw.trim() === '') return inner;

  const safe = sanitizeUrl(raw);
  if (!safe.ok) {
    ctx.report({ ...safe.error, path: ctx.path });
    return inner;
  }
  if (ctx.platform !== undefined) {
    return createElement(ctx.platform.Link, { href: safe.value }, inner);
  }
  return createElement('a', { href: safe.value }, inner);
};

/**
 * The node types of the supported Lexical subset (ADR-017). Anything else is dropped with a
 * diagnostic, never passed through: rendering is an allowlist.
 */
export const richTextConverters: RichTextConverters = Object.freeze({
  text,
  linebreak,
  paragraph,
  heading,
  quote,
  list,
  listitem,
  link,
});
