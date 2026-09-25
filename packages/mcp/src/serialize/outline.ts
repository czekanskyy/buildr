import type { BuilderDocument, NodeId, PageNode, RegistryMeta, Result, Value } from '@buildr/core';
import { err, ok } from '@buildr/core';
import { quote, truncate } from './text.ts';

export const DEFAULT_OUTLINE_DEPTH = 3;
/** The default cap of the text outline; past it the output ends with a note on how to narrow it. */
export const DEFAULT_OUTLINE_MAX_CHARS = 30_000;
/** The default node cap of the JSON outline. */
export const DEFAULT_OUTLINE_MAX_NODES = 500;

export interface OutlineOptions {
  /** The subtree to show; defaults to the document root. */
  readonly nodeId?: NodeId | undefined;
  /** Levels shown below the start node (0 = only the node itself). Default 3. */
  readonly depth?: number | undefined;
  /** Text variant only: stop after this many characters. Default 30000. */
  readonly maxChars?: number | undefined;
  /** JSON variant only: stop after this many nodes. Default 500. */
  readonly maxNodes?: number | undefined;
  /** Show this locale's translation of the primary prop when there is one. */
  readonly locale?: string | undefined;
}

/** One node of the JSON outline. */
export interface OutlineEntry {
  readonly id: NodeId;
  readonly type: string;
  readonly name?: string;
  /** The primary prop (the inline-editable text, typically) as a short string. */
  readonly text?: string;
  /** Set when the primary prop is not a static value. */
  readonly textKind?: 'binding' | 'expression';
  /** Locales that have a translation of the primary prop. */
  readonly translations?: readonly string[];
  readonly locked?: readonly ('structure' | 'content' | 'style')[];
  readonly hidden?: true;
  readonly conditional?: true;
  readonly template?: string;
  /** Descendants not shown because of the depth or size limit. */
  readonly hiddenDescendants?: number;
  /** Children per slot; every slot of the component is listed when it has a non-default slot. */
  readonly slots?: Readonly<Record<string, readonly OutlineEntry[]>>;
}

export interface OutlineJson {
  readonly root: OutlineEntry;
  readonly nodeCount: number;
  /** True when `maxNodes` cut the output. */
  readonly truncated: boolean;
}

export interface OutlineError {
  readonly code: 'node-not-found';
  readonly message: string;
}

const PRIMARY_KINDS = ['text', 'textarea', 'richText'] as const;

function primaryProp(meta: ReturnType<RegistryMeta['get']>): string | undefined {
  if (!meta) return undefined;
  const inline = meta.editor?.inlineProp;
  if (inline !== undefined && meta.props[inline] !== undefined) return inline;
  for (const kind of PRIMARY_KINDS) {
    const found = Object.entries(meta.props).find(([, def]) => def.kind === kind);
    if (found) return found[0];
  }
  return undefined;
}

function plainText(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) plainText(item, out);
  } else if (value !== null && typeof value === 'object') {
    const record = value as { text?: unknown; children?: unknown; root?: unknown };
    if (typeof record.text === 'string') out.push(record.text);
    if (record.children !== undefined) plainText(record.children, out);
    if (record.root !== undefined) plainText(record.root, out);
  }
  return out;
}

function primaryText(
  value: Value,
  locale: string | undefined,
): Pick<OutlineEntry, 'text' | 'textKind' | 'translations'> {
  if (value.kind === 'binding') return { text: value.path, textKind: 'binding' };
  if (value.kind === 'expression') return { text: value.expr, textKind: 'expression' };
  const translated = locale !== undefined ? value.l10n?.[locale] : undefined;
  const shown = translated !== undefined ? translated : value.value;
  const text = truncate(plainText(shown).join(' '), 60);
  const locales = value.l10n !== undefined ? Object.keys(value.l10n) : [];
  return {
    ...(text.length > 0 ? { text } : {}),
    ...(locales.length > 0 ? { translations: locales } : {}),
  };
}

function subtreeSize(doc: BuilderDocument, id: NodeId, seen = new Set<NodeId>()): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  const node = doc.nodes[id];
  if (!node) return 0;
  let n = 1;
  for (const children of Object.values(node.slots ?? {})) {
    for (const child of children) n += subtreeSize(doc, child, seen);
  }
  return n;
}

function hasHiddenStyle(node: PageNode): boolean {
  return node.styles?.base?.visibility?.hidden === true;
}

/** Builds the outline of a subtree as data; both renderings derive from it. */
export function buildOutline(
  doc: BuilderDocument,
  registry: RegistryMeta,
  options: OutlineOptions = {},
): Result<OutlineJson, OutlineError> {
  const startId = options.nodeId ?? doc.root;
  if (!Object.hasOwn(doc.nodes, startId)) {
    return err({
      code: 'node-not-found',
      message: `There is no node "${startId}" in this document; ids come from the outline.`,
    });
  }
  const maxDepth = Math.max(0, options.depth ?? DEFAULT_OUTLINE_DEPTH);
  const maxNodes = Math.max(1, options.maxNodes ?? DEFAULT_OUTLINE_MAX_NODES);
  let count = 0;
  let truncated = false;
  const visited = new Set<NodeId>();

  const build = (id: NodeId, level: number): OutlineEntry | undefined => {
    const node = doc.nodes[id];
    if (!node || visited.has(id)) return undefined;
    visited.add(id);
    count += 1;
    const meta = registry.get(node.type);
    const primary = primaryProp(meta);
    const value = primary !== undefined ? node.props?.[primary] : undefined;
    const locked = (['structure', 'content', 'style'] as const).filter(
      (aspect) => node.lock?.[aspect] === true,
    );
    const slotNames = [
      ...new Set([...Object.keys(meta?.slots ?? {}), ...Object.keys(node.slots ?? {})]),
    ];
    const showSlots = slotNames.some((name) => name !== 'default');
    let slots: Record<string, OutlineEntry[]> | undefined;
    let hiddenDescendants = 0;
    const childIds = Object.values(node.slots ?? {}).flat();
    if (level >= maxDepth) {
      hiddenDescendants = childIds.reduce((n, child) => n + subtreeSize(doc, child), 0);
    } else if (childIds.length > 0 || showSlots) {
      slots = {};
      for (const name of showSlots ? slotNames : ['default']) {
        const entries: OutlineEntry[] = [];
        for (const child of node.slots?.[name] ?? []) {
          if (count >= maxNodes) {
            truncated = true;
            hiddenDescendants += subtreeSize(doc, child);
            continue;
          }
          const entry = build(child, level + 1);
          if (entry) entries.push(entry);
        }
        slots[name] = entries;
      }
    }
    return {
      id,
      type: node.type,
      ...(node.name !== undefined ? { name: node.name } : {}),
      ...(value !== undefined ? primaryText(value, options.locale) : {}),
      ...(locked.length > 0 ? { locked } : {}),
      ...(hasHiddenStyle(node) ? { hidden: true as const } : {}),
      ...(node.visibleIf !== undefined ? { conditional: true as const } : {}),
      ...(node.source !== undefined ? { template: node.source.template } : {}),
      ...(hiddenDescendants > 0 ? { hiddenDescendants } : {}),
      ...(slots !== undefined ? { slots } : {}),
    };
  };

  const root = build(startId, 0);
  if (!root) return err({ code: 'node-not-found', message: `Node "${startId}" cannot be read.` });
  return ok({ root, nodeCount: count, truncated });
}

function line(entry: OutlineEntry): string {
  const parts: string[] = [entry.id, entry.type];
  if (entry.name !== undefined) parts.push(quote(entry.name, 30));
  if (entry.text !== undefined) {
    if (entry.textKind === 'binding') parts.push(`text=@${entry.text}`);
    else if (entry.textKind === 'expression') parts.push(`text=\`${truncate(entry.text, 40)}\``);
    else parts.push(quote(entry.text, 40));
  }
  if (entry.translations) parts.push(`[l10n:${entry.translations.join(',')}]`);
  if (entry.locked) parts.push(`[locked:${entry.locked.join(',')}]`);
  if (entry.hidden) parts.push('[hidden]');
  if (entry.conditional) parts.push('[if]');
  if (entry.template !== undefined) parts.push(`[tpl:${entry.template}]`);
  if (entry.hiddenDescendants) parts.push(`(+${entry.hiddenDescendants} more)`);
  return parts.join(' ');
}

/**
 * The indented text outline: one line per node (`id type "name" "text" [markers]`), children
 * indented by two spaces; components with named slots print `slot:` headers. Ends with a note
 * when `maxChars` cut it. Token-efficient by design: use `nodeId` and `depth` to zoom.
 */
export function renderOutline(
  doc: BuilderDocument,
  registry: RegistryMeta,
  options: OutlineOptions = {},
): Result<string, OutlineError> {
  const built = buildOutline(doc, registry, { ...options, maxNodes: Number.MAX_SAFE_INTEGER });
  if (!built.ok) return built;
  const maxChars = options.maxChars ?? DEFAULT_OUTLINE_MAX_CHARS;
  const lines: string[] = [];
  let chars = 0;
  let shown = 0;
  let stopped = false;

  const push = (text: string): boolean => {
    if (chars + text.length + 1 > maxChars) {
      stopped = true;
      return false;
    }
    lines.push(text);
    chars += text.length + 1;
    return true;
  };

  const emit = (entry: OutlineEntry, indent: number): void => {
    if (stopped) return;
    if (!push(`${'  '.repeat(indent)}${line(entry)}`)) return;
    shown += 1;
    const slots = entry.slots ?? {};
    const named = Object.keys(slots).some((name) => name !== 'default');
    for (const [name, children] of Object.entries(slots)) {
      if (named) {
        const header = `${'  '.repeat(indent + 1)}${name}:${children.length === 0 ? ' (empty)' : ''}`;
        if (!push(header)) return;
      }
      for (const child of children) emit(child, indent + (named ? 2 : 1));
    }
  };
  emit(built.value.root, 0);

  if (stopped) {
    lines.push(
      `... output cut after ${shown} of ${built.value.nodeCount} nodes; pass a smaller depth or a nodeId to see more.`,
    );
  }
  return ok(lines.join('\n'));
}

/** The JSON variant of the outline, for clients that prefer structured content. */
export function outlineToJson(
  doc: BuilderDocument,
  registry: RegistryMeta,
  options: OutlineOptions = {},
): Result<OutlineJson, OutlineError> {
  return buildOutline(doc, registry, options);
}
