import { parseFragment } from 'parse5';

// The Text `html` sanitiser (ADR-026). This is the only place core parses HTML, and the only reason
// `parse5` is a dependency: the input is untrusted markup (even from a trusted editor), the parse is
// the same one a browser does, so what we check is what a browser would build, and the output is
// rebuilt from an allowlist, never copied. Result: a small tree of text and allowed elements with
// allowed attributes. No script, no handler, no `javascript:` URL, no style, no embed.

export const MAX_HTML_LENGTH = 20000;
export const MAX_HTML_NODES = 2000;
export const MAX_HTML_DEPTH = 16;

export type HtmlNode = HtmlText | HtmlElement;
export interface HtmlText {
  readonly kind: 'text';
  readonly text: string;
}
export interface HtmlElement {
  readonly kind: 'element';
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly HtmlNode[];
}

export interface SanitizedHtml {
  readonly nodes: readonly HtmlNode[];
  /** What was removed, for an audit trail and a diagnostic; empty when the input was already clean. */
  readonly removed: readonly string[];
}

const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'cite',
  'code',
  'del',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
  'ul',
]);
const VOID_TAGS: ReadonlySet<string> = new Set(['br', 'hr']);
/** Elements that are dropped together with everything inside them (unlike unknown tags, which are unwrapped). */
const DROPPED_WITH_CONTENT: ReadonlySet<string> = new Set([
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'template',
  'noscript',
  'noembed',
  'noframes',
  'textarea',
  'select',
  'option',
  'title',
  'head',
  'svg',
  'math',
  'form',
  'input',
  'button',
  'link',
  'meta',
  'base',
  'audio',
  'video',
  'source',
  'track',
  'canvas',
  'img',
  'picture',
  'map',
  'area',
  'dialog',
  'xmp',
  'plaintext',
  'listing',
]);
const GLOBAL_ATTRIBUTES: ReadonlySet<string> = new Set(['title', 'lang', 'dir']);
const MAX_ATTRIBUTE_LENGTH = 512;
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
/** `value` without whitespace, control characters, C1 and the Unicode separators (what a URL parser ignores or rejects). */
function stripControl(value: string): string {
  let out = '';
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029)
      continue;
    out += value.charAt(index);
  }
  return out;
}
const ALLOWED_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'mailto', 'tel']);

/** `undefined` when the URL is not allowed. Compared after the parser decoded entities and with whitespace removed. */
export function safeHref(raw: string): string | undefined {
  const value = raw.trim();
  if (value === '' || value.length > MAX_ATTRIBUTE_LENGTH) return undefined;
  const compact = stripControl(value);
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(compact);
  if (scheme !== null) {
    return ALLOWED_SCHEMES.has((scheme[1] ?? '').toLowerCase()) ? value : undefined;
  }
  // Relative: a path, a query or a fragment. `//host` (protocol-relative) and backslashes are not.
  if (compact.startsWith('//') || compact.includes('\\')) return undefined;
  if (compact.includes(':') && !/^[#?/]/.test(compact)) return undefined;
  return value;
}

interface RawNode {
  readonly nodeName: string;
  readonly tagName?: string;
  readonly namespaceURI?: string;
  readonly attrs?: readonly { readonly name: string; readonly value: string }[];
  readonly childNodes?: readonly RawNode[];
  readonly value?: string;
}

function cleanAttributes(
  tag: string,
  raw: readonly { readonly name: string; readonly value: string }[],
  removed: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  let external = false;
  for (const { name: rawName, value } of raw) {
    const name = rawName.toLowerCase();
    if (value.length > MAX_ATTRIBUTE_LENGTH) {
      removed.push(`${tag}[${name}]`);
      continue;
    }
    if (GLOBAL_ATTRIBUTES.has(name)) {
      if (name === 'dir' && value !== 'ltr' && value !== 'rtl' && value !== 'auto') {
        removed.push(`${tag}[${name}]`);
        continue;
      }
      Object.defineProperty(out, name, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else if (tag === 'a' && name === 'href') {
      const href = safeHref(value);
      if (href === undefined) removed.push(`a[href=${value.slice(0, 30)}]`);
      else
        Object.defineProperty(out, 'href', {
          value: href,
          enumerable: true,
          writable: true,
          configurable: true,
        });
    } else if (tag === 'a' && name === 'target') {
      if (value === '_blank') external = true;
      else if (value !== '_self') removed.push('a[target]');
    } else {
      removed.push(`${tag}[${name}]`);
    }
  }
  if (tag === 'a' && external) {
    Object.defineProperty(out, 'target', {
      value: '_blank',
      enumerable: true,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(out, 'rel', {
      value: 'noopener noreferrer',
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/**
 * Parses `source` as an HTML fragment and returns only what the allowlist keeps. Never throws and
 * never returns anything outside the allowlist: a longer source than `MAX_HTML_LENGTH`, or a tree
 * past the node or depth caps, is cut short (what does not fit is dropped and reported).
 */
export function sanitizeHtml(source: unknown): SanitizedHtml {
  if (typeof source !== 'string' || source === '') return { nodes: [], removed: [] };
  const removed: string[] = [];
  let text = source;
  if (text.length > MAX_HTML_LENGTH) {
    text = text.slice(0, MAX_HTML_LENGTH);
    removed.push('(text past the length limit)');
  }
  const budget = { nodes: 0 };

  const convert = (raw: readonly RawNode[], depth: number): HtmlNode[] => {
    const out: HtmlNode[] = [];
    for (const node of raw) {
      if (budget.nodes >= MAX_HTML_NODES) {
        removed.push('(nodes past the limit)');
        break;
      }
      if (node.nodeName === '#text') {
        const value = node.value ?? '';
        if (value === '') continue;
        budget.nodes++;
        const previous = out[out.length - 1];
        if (previous?.kind === 'text')
          out[out.length - 1] = { kind: 'text', text: previous.text + value };
        else out.push({ kind: 'text', text: value });
        continue;
      }
      if (node.nodeName.startsWith('#')) {
        // A comment or a doctype: nothing a reader sees.
        if (node.nodeName === '#comment') removed.push('(comment)');
        continue;
      }
      const tag = (node.tagName ?? node.nodeName).toLowerCase();
      if (node.namespaceURI !== undefined && node.namespaceURI !== HTML_NAMESPACE) {
        removed.push(tag);
        continue;
      }
      if (DROPPED_WITH_CONTENT.has(tag)) {
        removed.push(tag);
        continue;
      }
      const children = depth >= MAX_HTML_DEPTH ? [] : convert(node.childNodes ?? [], depth + 1);
      if (depth >= MAX_HTML_DEPTH && (node.childNodes?.length ?? 0) > 0)
        removed.push('(depth limit)');
      if (!ALLOWED_TAGS.has(tag)) {
        // An unknown element: keep what is inside it, lose the wrapper.
        removed.push(tag);
        out.push(...children);
        continue;
      }
      budget.nodes++;
      out.push({
        kind: 'element',
        tag,
        attrs: cleanAttributes(tag, node.attrs ?? [], removed),
        children: VOID_TAGS.has(tag) ? [] : children,
      });
    }
    return out;
  };

  const fragment = parseFragment(text) as unknown as RawNode;
  return { nodes: convert(fragment.childNodes ?? [], 0), removed };
}

const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Serialises sanitised nodes. Re-sanitising the result gives the same string (it is idempotent). */
export function serializeHtml(nodes: readonly HtmlNode[]): string {
  let out = '';
  for (const node of nodes) {
    if (node.kind === 'text') {
      out += escapeText(node.text);
      continue;
    }
    const attrs = Object.entries(node.attrs)
      .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
      .join('');
    if (VOID_TAGS.has(node.tag)) {
      out += `<${node.tag}${attrs}>`;
      continue;
    }
    // The HTML serialisation algorithm: a parser drops one newline right after `<pre>`, so when the
    // content starts with one, write an extra so that parsing the output gives the same tree.
    const first = node.children[0];
    const lead =
      node.tag === 'pre' && first?.kind === 'text' && first.text.startsWith('\n') ? '\n' : '';
    out += `<${node.tag}${attrs}>${lead}${serializeHtml(node.children)}</${node.tag}>`;
  }
  return out;
}

/** The canonical, safe form of `source`: what gets stored and what gets rendered. */
export function sanitizeHtmlToString(source: unknown): string {
  return serializeHtml(sanitizeHtml(source).nodes);
}
