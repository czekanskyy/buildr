import { $createLinkNode } from '@lexical/link';
import { $createListItemNode, $createListNode } from '@lexical/list';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import {
  type JsonValue,
  normalizeRichText,
  type RichTextBlockNode,
  type RichTextInlineNode,
  type RichTextRootNode,
  richTextSchema,
} from '@next-buildr/core';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type EditorState,
  type ElementNode,
  type LexicalNode,
} from 'lexical';

/** The tags the toolbar offers; the format itself allows h1 to h6, so pasted h1 still round-trips. */
export const HEADING_TAGS = ['h2', 'h3', 'h4'] as const;

/** A well-formed empty document: one empty paragraph is what the editor shows, and what it saves. */
export const EMPTY_RICH_TEXT: RichTextRootNode = { type: 'root', version: 1, children: [] };

/**
 * What a rich text prop holds, as the format the renderer reads. Anything that is not a rich text
 * document (a `null` default, a plain string, corrupt JSON) becomes an empty one; nothing throws.
 */
export function toRichText(value: unknown): RichTextRootNode {
  if (value === null || value === undefined) return EMPTY_RICH_TEXT;
  const parsed = richTextSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return normalizeRichText(value as JsonValue).value;
}

function inline(node: RichTextInlineNode): LexicalNode {
  switch (node.type) {
    case 'text':
      return $createTextNode(node.text).setFormat(node.format);
    case 'linebreak':
      return $createLineBreakNode();
    case 'link': {
      const link = $createLinkNode(node.url);
      link.append(...node.children.map(inline));
      return link;
    }
  }
}

function block(node: RichTextBlockNode): ElementNode {
  switch (node.type) {
    case 'paragraph': {
      const paragraph = $createParagraphNode();
      paragraph.append(...node.children.map(inline));
      return paragraph;
    }
    case 'heading': {
      const heading = $createHeadingNode(node.tag);
      heading.append(...node.children.map(inline));
      return heading;
    }
    case 'quote': {
      const quote = $createQuoteNode();
      quote.append(...node.children.map(inline));
      return quote;
    }
    case 'list': {
      const list = $createListNode(node.listType === 'number' ? 'number' : 'bullet');
      for (const item of node.children) {
        const entry = $createListItemNode();
        entry.append(
          ...item.children.map((child) => (child.type === 'list' ? block(child) : inline(child))),
        );
        list.append(entry);
      }
      return list;
    }
  }
}

/** Replaces the editor's content with `root`. Call inside `editor.update`. */
export function $loadRichText(root: RichTextRootNode): void {
  const top = $getRoot();
  top.clear();
  for (const child of root.children) top.append(block(child));
  if (root.children.length === 0) top.append($createParagraphNode());
}

/**
 * The editor's content in the core rich text format, or `undefined` when it does not conform (which
 * the walk into `normalizeRichText` makes impossible, but the schema has the last word — nothing
 * that fails `richTextSchema` ever reaches the document).
 */
export function serializeRichText(state: EditorState): RichTextRootNode | undefined {
  const json = state.toJSON().root as unknown as JsonValue;
  const { value } = normalizeRichText(json);
  const checked = richTextSchema.safeParse(value);
  if (!checked.success) return undefined;
  // An editor holding only an empty paragraph is an empty document.
  const [only] = checked.data.children;
  if (
    checked.data.children.length === 1 &&
    only?.type === 'paragraph' &&
    only.children.length === 0
  ) {
    return { ...checked.data, children: [] };
  }
  return checked.data;
}
