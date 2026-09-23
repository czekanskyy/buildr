import { z } from 'zod';
import type { JsonValue } from '../json/json-value.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import { capString, sanitizeUrl } from './sanitize.ts';

/** How deep a rich text tree may nest (mainly bounds `list` inside `listitem` inside `list`, ...) before `normalizeRichText` gives up on a branch rather than recursing further. */
export const MAX_RICH_TEXT_DEPTH = 32;
/** A single `text` node's content, capped defensively (docs/document-model.md#limits uses the same figure for a document's ordinary string props). */
export const MAX_RICH_TEXT_STRING_LENGTH = 50_000;

export interface RichTextTextNode {
  readonly type: 'text';
  readonly version: number;
  readonly text: string;
  readonly format: number;
}

export interface RichTextLineBreakNode {
  readonly type: 'linebreak';
  readonly version: number;
}

export interface RichTextLinkNode {
  readonly type: 'link';
  readonly version: number;
  readonly url: string;
  readonly children: readonly RichTextInlineNode[];
}

export type RichTextInlineNode = RichTextTextNode | RichTextLineBreakNode | RichTextLinkNode;

export interface RichTextParagraphNode {
  readonly type: 'paragraph';
  readonly version: number;
  readonly children: readonly RichTextInlineNode[];
}

export type RichTextHeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export interface RichTextHeadingNode {
  readonly type: 'heading';
  readonly version: number;
  readonly tag: RichTextHeadingTag;
  readonly children: readonly RichTextInlineNode[];
}

export interface RichTextQuoteNode {
  readonly type: 'quote';
  readonly version: number;
  readonly children: readonly RichTextInlineNode[];
}

export interface RichTextListItemNode {
  readonly type: 'listitem';
  readonly version: number;
  readonly children: readonly (RichTextInlineNode | RichTextListNode)[];
}

export type RichTextListType = 'bullet' | 'number';

export interface RichTextListNode {
  readonly type: 'list';
  readonly version: number;
  readonly listType: RichTextListType;
  readonly children: readonly RichTextListItemNode[];
}

export type RichTextBlockNode =
  | RichTextParagraphNode
  | RichTextHeadingNode
  | RichTextQuoteNode
  | RichTextListNode;

export interface RichTextRootNode {
  readonly type: 'root';
  readonly version: number;
  readonly children: readonly RichTextBlockNode[];
}

export type RichTextNode =
  | RichTextRootNode
  | RichTextBlockNode
  | RichTextListItemNode
  | RichTextInlineNode;

const HEADING_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
] as const satisfies readonly RichTextHeadingTag[];
const LIST_TYPES = ['bullet', 'number'] as const satisfies readonly RichTextListType[];

// Branch schemas are deliberately left to TS's own inference (no `: z.ZodType<X>` annotation):
// widening one to the interface up front erases the discriminant info `z.discriminatedUnion`
// needs from its branches. Each is checked against its interface with `satisfies` instead, which
// verifies the shape without widening the variable's type.
const textNodeSchema = z.strictObject({
  type: z.literal('text'),
  version: z.number().int().nonnegative(),
  text: z.string(),
  format: z.number().int().nonnegative(),
}) satisfies z.ZodType<RichTextTextNode>;

const lineBreakNodeSchema = z.strictObject({
  type: z.literal('linebreak'),
  version: z.number().int().nonnegative(),
}) satisfies z.ZodType<RichTextLineBreakNode>;

// `inlineNodeSchema` and `linkNodeSchema` are mutually recursive (a link's children are inline
// nodes, one of which can be a link). Only `inlineNodeSchema` needs the explicit annotation plus
// `z.lazy` (matching `dataTypeSchema` in `schema/data-type.ts`) to anchor the cycle; by the time
// `linkNodeSchema`'s own initializer runs, `inlineNodeSchema`'s (declared) type is already known,
// so it can reference it directly without also needing to be lazy.
const inlineNodeSchema: z.ZodType<RichTextInlineNode> = z.lazy(() =>
  z.discriminatedUnion('type', [textNodeSchema, lineBreakNodeSchema, linkNodeSchema]),
);

const linkNodeSchema = z.strictObject({
  type: z.literal('link'),
  version: z.number().int().nonnegative(),
  url: z.string(),
  children: z.array(inlineNodeSchema),
}) satisfies z.ZodType<RichTextLinkNode>;

const inlineChildrenSchema = z.array(inlineNodeSchema);

const paragraphNodeSchema = z.strictObject({
  type: z.literal('paragraph'),
  version: z.number().int().nonnegative(),
  children: inlineChildrenSchema,
}) satisfies z.ZodType<RichTextParagraphNode>;

const headingNodeSchema = z.strictObject({
  type: z.literal('heading'),
  version: z.number().int().nonnegative(),
  tag: z.enum(HEADING_TAGS),
  children: inlineChildrenSchema,
}) satisfies z.ZodType<RichTextHeadingNode>;

const quoteNodeSchema = z.strictObject({
  type: z.literal('quote'),
  version: z.number().int().nonnegative(),
  children: inlineChildrenSchema,
}) satisfies z.ZodType<RichTextQuoteNode>;

// `list` and `listitem` are mutually recursive with no outside anchor (a list item's children can
// themselves be a nested list), so — like `dataTypeSchema`/`dataFieldSchema` — both need the
// explicit annotation and `z.lazy`. That in turn means `listNodeSchema`'s type is the widened
// `z.ZodType<RichTextListNode>`, so it cannot itself be a `discriminatedUnion` branch (see above);
// `blockNodeSchema` below uses a plain `z.union` instead.
const listItemNodeSchema: z.ZodType<RichTextListItemNode> = z.lazy(() =>
  z.strictObject({
    type: z.literal('listitem'),
    version: z.number().int().nonnegative(),
    children: z.array(z.union([inlineNodeSchema, listNodeSchema])),
  }),
);

const listNodeSchema: z.ZodType<RichTextListNode> = z.lazy(() =>
  z.strictObject({
    type: z.literal('list'),
    version: z.number().int().nonnegative(),
    listType: z.enum(LIST_TYPES),
    children: z.array(listItemNodeSchema),
  }),
);

const blockNodeSchema: z.ZodType<RichTextBlockNode> = z.union([
  paragraphNodeSchema,
  headingNodeSchema,
  quoteNodeSchema,
  listNodeSchema,
]);

/**
 * A validated subset of Lexical's serialized JSON node format (ADR-017): `root`, `paragraph`,
 * `heading`, `list`, `listitem`, `quote`, `link`, `text` (with a format bitmask), `linebreak`. A
 * value that already conforms — typically one that came out of `normalizeRichText` — parses
 * against this schema; anything else, including a document with an unknown node type anywhere in
 * the tree, is rejected outright (use `normalizeRichText` to recover a valid tree from untrusted
 * input instead).
 */
export const richTextSchema: z.ZodType<RichTextRootNode> = z.strictObject({
  type: z.literal('root'),
  version: z.number().int().nonnegative(),
  children: z.array(blockNodeSchema),
});

const EMPTY_ROOT: RichTextRootNode = { type: 'root', version: 1, children: [] };

function isPlainObject(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A single point for reading a named field off a `JsonValue` object arm — `noPropertyAccessFromIndexSignature` requires bracket access on an index-signature type, and routing it through a variable key here (rather than a literal at each call site) keeps every caller a plain, dot-notation-eligible-looking call instead of a bracket expression. */
function field(value: { readonly [key: string]: JsonValue }, key: string): JsonValue {
  return value[key] ?? null;
}

function nodeType(value: JsonValue): string | undefined {
  if (!isPlainObject(value)) return undefined;
  const type = field(value, 'type');
  return typeof type === 'string' ? type : undefined;
}

function versionOf(value: { readonly [key: string]: JsonValue }): number {
  const version = field(value, 'version');
  return typeof version === 'number' && Number.isInteger(version) && version >= 0 ? version : 1;
}

function childrenOf(value: { readonly [key: string]: JsonValue }): readonly JsonValue[] {
  const children = field(value, 'children');
  return Array.isArray(children) ? children : [];
}

function unknownNodeDiagnostic(path: readonly (string | number)[], type: string): Diagnostic {
  return {
    code: 'richtext.unknown-node',
    message: `unknown rich text node type "${type}" was dropped`,
    severity: 'warning',
    path,
    details: { type },
  };
}

function maxDepthDiagnostic(path: readonly (string | number)[]): Diagnostic {
  return {
    code: 'richtext.max-depth',
    message: `rich text nesting exceeds the maximum depth of ${MAX_RICH_TEXT_DEPTH}`,
    severity: 'warning',
    path,
  };
}

function normalizeText(value: { readonly [key: string]: JsonValue }): RichTextTextNode {
  const rawText = field(value, 'text');
  const text = typeof rawText === 'string' ? capString(rawText, MAX_RICH_TEXT_STRING_LENGTH) : '';
  const rawFormat = field(value, 'format');
  const format =
    typeof rawFormat === 'number' && Number.isInteger(rawFormat) && rawFormat >= 0 ? rawFormat : 0;
  return { type: 'text', version: versionOf(value), text, format };
}

function normalizeInlineChildren(
  children: readonly JsonValue[],
  path: readonly (string | number)[],
  depth: number,
  diagnostics: Diagnostic[],
): readonly RichTextInlineNode[] {
  const result: RichTextInlineNode[] = [];
  children.forEach((child, index) => {
    const node = normalizeInline(child, [...path, 'children', index], depth, diagnostics);
    if (node !== undefined) result.push(node);
  });
  return result;
}

function normalizeInline(
  value: JsonValue,
  path: readonly (string | number)[],
  depth: number,
  diagnostics: Diagnostic[],
): RichTextInlineNode | undefined {
  const type = nodeType(value);
  if (type === undefined || !isPlainObject(value)) return undefined;

  if (depth > MAX_RICH_TEXT_DEPTH) {
    diagnostics.push(maxDepthDiagnostic(path));
    return undefined;
  }

  if (type === 'text') return normalizeText(value);
  if (type === 'linebreak') return { type: 'linebreak', version: versionOf(value) };
  if (type === 'link') {
    const urlField = field(value, 'url');
    const rawUrl = typeof urlField === 'string' ? urlField : '';
    const sanitized = sanitizeUrl(rawUrl);
    if (!sanitized.ok) {
      diagnostics.push({ ...sanitized.error, path });
    }
    return {
      type: 'link',
      version: versionOf(value),
      url: sanitized.ok ? sanitized.value : '',
      children: normalizeInlineChildren(childrenOf(value), path, depth + 1, diagnostics),
    };
  }

  diagnostics.push(unknownNodeDiagnostic(path, type));
  return undefined;
}

function normalizeListItemChildren(
  children: readonly JsonValue[],
  path: readonly (string | number)[],
  depth: number,
  diagnostics: Diagnostic[],
): readonly (RichTextInlineNode | RichTextListNode)[] {
  const result: (RichTextInlineNode | RichTextListNode)[] = [];
  children.forEach((child, index) => {
    const childPath = [...path, 'children', index];
    if (nodeType(child) === 'list') {
      const list = normalizeBlock(child, childPath, depth, diagnostics);
      if (list?.type === 'list') result.push(list);
      return;
    }
    const inline = normalizeInline(child, childPath, depth, diagnostics);
    if (inline !== undefined) result.push(inline);
  });
  return result;
}

function normalizeBlock(
  value: JsonValue,
  path: readonly (string | number)[],
  depth: number,
  diagnostics: Diagnostic[],
): RichTextBlockNode | undefined {
  const type = nodeType(value);
  if (type === undefined || !isPlainObject(value)) return undefined;

  if (depth > MAX_RICH_TEXT_DEPTH) {
    diagnostics.push(maxDepthDiagnostic(path));
    return undefined;
  }

  if (type === 'paragraph') {
    return {
      type: 'paragraph',
      version: versionOf(value),
      children: normalizeInlineChildren(childrenOf(value), path, depth + 1, diagnostics),
    };
  }
  if (type === 'heading') {
    const rawTag = field(value, 'tag');
    const tag = HEADING_TAGS.includes(rawTag as RichTextHeadingTag)
      ? (rawTag as RichTextHeadingTag)
      : 'h1';
    return {
      type: 'heading',
      version: versionOf(value),
      tag,
      children: normalizeInlineChildren(childrenOf(value), path, depth + 1, diagnostics),
    };
  }
  if (type === 'quote') {
    return {
      type: 'quote',
      version: versionOf(value),
      children: normalizeInlineChildren(childrenOf(value), path, depth + 1, diagnostics),
    };
  }
  if (type === 'list') {
    const rawListType = field(value, 'listType');
    const listType = LIST_TYPES.includes(rawListType as RichTextListType)
      ? (rawListType as RichTextListType)
      : 'bullet';
    const items: RichTextListItemNode[] = [];
    childrenOf(value).forEach((child, index) => {
      const itemPath = [...path, 'children', index];
      if (nodeType(child) !== 'listitem' || !isPlainObject(child)) {
        if (nodeType(child) !== undefined)
          diagnostics.push(unknownNodeDiagnostic(itemPath, nodeType(child) ?? 'unknown'));
        return;
      }
      items.push({
        type: 'listitem',
        version: versionOf(child),
        children: normalizeListItemChildren(childrenOf(child), itemPath, depth + 1, diagnostics),
      });
    });
    return { type: 'list', version: versionOf(value), listType, children: items };
  }

  diagnostics.push(unknownNodeDiagnostic(path, type));
  return undefined;
}

/**
 * Walks arbitrary, untrusted JSON — a document field, a clipboard fragment, a Payload rich text
 * value — into a tree that always conforms to `richTextSchema`. Any node of an unrecognized type
 * is dropped (with a diagnostic) rather than passed through raw (ADR-017); a link's `url` is run
 * through `sanitizeUrl`, falling back to `''` when unsafe; a `text` node's content is capped at
 * `MAX_RICH_TEXT_STRING_LENGTH`; nesting beyond `MAX_RICH_TEXT_DEPTH` is truncated. Never throws —
 * the worst case for a completely unrecognizable input is an empty root.
 */
export function normalizeRichText(value: JsonValue): {
  readonly value: RichTextRootNode;
  readonly diagnostics: readonly Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];

  if (!isPlainObject(value) || nodeType(value) !== 'root') {
    diagnostics.push({
      code: 'richtext.invalid-root',
      message: 'expected a rich text root node',
      severity: 'error',
    });
    return { value: EMPTY_ROOT, diagnostics };
  }

  const children: RichTextBlockNode[] = [];
  childrenOf(value).forEach((child, index) => {
    const block = normalizeBlock(child, ['children', index], 1, diagnostics);
    if (block !== undefined) children.push(block);
  });

  return { value: { type: 'root', version: versionOf(value), children }, diagnostics };
}

/** The minimal rich text document for a plain string — a single paragraph holding a single text node (docs/dynamic-bindings.md#coercions: "string becomes a single paragraph"). */
export function plainTextToRichText(text: string): RichTextRootNode {
  return {
    type: 'root',
    version: 1,
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [
          {
            type: 'text',
            version: 1,
            text: capString(text, MAX_RICH_TEXT_STRING_LENGTH),
            format: 0,
          },
        ],
      },
    ],
  };
}
