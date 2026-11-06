import type { PageNode, Value } from '../document/types.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import {
  checkAttributes,
  checkClasses,
  isAllowedAttributeName,
  isValidClassName,
} from './attributes.ts';
import { authorCodeEnabled, type HostCapabilities } from './capabilities.ts';
import { checkCustomCss } from './css.ts';
import { sanitizeHtmlToString } from './html.ts';

// Where author code can sit on a node (ADR-026): three node fields, and the props of a component
// that are declared as author HTML (`p.textarea({ format: 'html' })`). Everything here is pure; the
// commands call it at write time, the renderers and `checkAuthorCode` call it at render and
// persistence time, and all of them fail closed without `capabilities.authorCode`.

/** The names of `meta`'s props that hold author HTML. */
export function htmlPropNames(meta: ComponentMeta | undefined): readonly string[] {
  if (meta === undefined) return [];
  return Object.entries(meta.props)
    .filter(([, def]) => def.kind === 'textarea' && def.format === 'html')
    .map(([name]) => name);
}

/** Whether a node carries any node-level author code (not counting html props). */
export function hasNodeAuthorFields(
  node: Pick<PageNode, 'customCss' | 'classes' | 'attributes'>,
): boolean {
  return (
    node.customCss !== undefined || node.classes !== undefined || node.attributes !== undefined
  );
}

/** Whether a node has any author code at all: the node fields, or a set html prop. */
export function hasAuthorCode(node: PageNode, meta: ComponentMeta | undefined): boolean {
  if (hasNodeAuthorFields(node)) return true;
  return htmlPropNames(meta).some(
    (name) => node.props !== undefined && Object.hasOwn(node.props, name),
  );
}

/** Checks the three node fields of a node as written (a fragment node, say). The first problem, or `undefined`. */
export function nodeAuthorFieldError(
  node: Pick<PageNode, 'customCss' | 'classes' | 'attributes'>,
): string | undefined {
  if (node.customCss !== undefined) {
    const css = checkCustomCss(node.customCss);
    if (!css.ok) return `customCss: ${css.error}`;
  }
  if (node.classes !== undefined) {
    const classes = checkClasses(node.classes);
    if (!classes.ok) return `classes: ${classes.error}`;
  }
  if (node.attributes !== undefined) {
    const attributes = checkAttributes(node.attributes);
    if (!attributes.ok) return `attributes: ${attributes.error}`;
  }
  return undefined;
}

/**
 * The node's html props with their stored values sanitised (the static value and each translation).
 * Returns the node itself when there is nothing to change.
 */
export function sanitizeNodeHtml(node: PageNode, meta: ComponentMeta | undefined): PageNode {
  const names = htmlPropNames(meta);
  if (names.length === 0 || node.props === undefined) return node;
  let props: Record<string, Value> | undefined;
  for (const name of names) {
    const value = Object.hasOwn(node.props, name) ? node.props[name] : undefined;
    if (value === undefined || value.kind !== 'static' || typeof value.value !== 'string') continue;
    const clean = sanitizeHtmlToString(value.value);
    const l10n =
      value.l10n === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(value.l10n).map(([code, text]) => [
              code,
              typeof text === 'string' ? sanitizeHtmlToString(text) : text,
            ]),
          );
    if (clean === value.value && JSON.stringify(l10n) === JSON.stringify(value.l10n)) continue;
    props ??= { ...node.props };
    props[name] = { ...value, value: clean, ...(l10n !== undefined ? { l10n } : {}) };
  }
  return props === undefined ? node : { ...node, props };
}

/**
 * Render-time view of a node's class names and attributes. Empty unless the host permits author
 * code, and even then only what passes the same rules as at write time (a document edited outside
 * the commands cannot smuggle anything through).
 */
export function authorNodeAttributes(
  node: Pick<PageNode, 'classes' | 'attributes'>,
  capabilities: HostCapabilities | null | undefined,
): { readonly classes: readonly string[]; readonly attributes: Readonly<Record<string, string>> } {
  if (!authorCodeEnabled(capabilities)) return { classes: [], attributes: {} };
  const classes = Array.isArray(node.classes)
    ? [...new Set((node.classes as unknown[]).filter(isValidClassName))].slice(0, 16)
    : [];
  const attributes: Record<string, string> = {};
  if (typeof node.attributes === 'object' && node.attributes !== null) {
    const checked = checkAttributes(
      Object.fromEntries(
        Object.entries(node.attributes).filter(
          ([name, value]) => isAllowedAttributeName(name) && typeof value === 'string',
        ),
      ),
    );
    // A map with one bad value is dropped whole rather than guessed at.
    if (checked.ok) {
      for (const [name, value] of Object.entries(checked.value)) {
        Object.defineProperty(attributes, name, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
  }
  return { classes, attributes };
}

/**
 * The persistence guard (for a host's write path, such as a Payload hook): every node that carries
 * author code, as an error when the host does not permit it, and as an error for each rule it
 * breaks when it does. Empty means the document is fine to store. Never throws.
 */
export function checkAuthorCode(
  doc: { readonly nodes: Readonly<Record<string, PageNode>> },
  capabilities: HostCapabilities | null | undefined,
  registry?: RegistryMeta,
): readonly Diagnostic[] {
  const enabled = authorCodeEnabled(capabilities);
  const out: Diagnostic[] = [];
  for (const [id, node] of Object.entries(doc.nodes)) {
    const meta = registry?.get(node.type);
    if (!hasAuthorCode(node, meta)) continue;
    if (!enabled) {
      out.push({
        code: 'author.not-permitted',
        message: `Node "${id}" carries author code (custom CSS, classes, attributes or HTML), which this host does not allow.`,
        severity: 'error',
        path: ['nodes', id],
        details: { nodeId: id },
      });
      continue;
    }
    const problem = nodeAuthorFieldError(node);
    if (problem !== undefined) {
      out.push({
        code: 'author.invalid',
        message: `Node "${id}": ${problem}`,
        severity: 'error',
        path: ['nodes', id],
        details: { nodeId: id },
      });
    }
    // An html prop is always sanitised on render; one whose stored text differs from its sanitised
    // form was not written through the commands, which is worth saying.
    for (const name of htmlPropNames(meta)) {
      const value = node.props?.[name];
      if (value?.kind === 'static' && typeof value.value === 'string') {
        if (sanitizeHtmlToString(value.value) !== value.value) {
          out.push({
            code: 'author.html-not-sanitised',
            message: `Node "${id}": the "${name}" HTML contains markup that is removed when rendered.`,
            severity: 'warning',
            path: ['nodes', id, 'props', name],
            details: { nodeId: id, prop: name },
          });
        }
      }
    }
  }
  return out;
}
