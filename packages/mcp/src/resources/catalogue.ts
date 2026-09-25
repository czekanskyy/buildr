import {
  type BuilderDocument,
  type DataField,
  type DataSchema,
  type DataType,
  instantiateTemplate,
  type PageNode,
  type RegistryMeta,
  type TemplateDefinition,
} from '@buildr/core';
import type { McpBackend, McpError } from '../backend.ts';
import { describeComponent, formatComponentDescription } from '../serialize/component.ts';
import { renderOutline } from '../serialize/outline.ts';
import { list, nearest, quote, truncate } from '../serialize/text.ts';
import { registryFromManifest } from '../session/session.ts';

// The discovery content (component list, descriptions, templates, style reference), rendered once
// per manifest hash. Tools and resources share one `DiscoveryCache` so both serve identical text.

export type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: McpError | string };

interface Snapshot {
  readonly hash: string;
  readonly registry: RegistryMeta;
  readonly memo: Map<string, string>;
}

const MEMO_LIMIT = 500;

export interface DiscoveryContent {
  readonly registry: RegistryMeta;
  /** Returns `produce()`, computed once per manifest hash and key; failures are not cached. */
  memo(key: string, produce: () => Rendered): Rendered;
}

export interface DiscoveryCache {
  /** The registry of the backend's current manifest; rebuilt only when the manifest hash changes. */
  load(backend: McpBackend): Promise<Loaded<DiscoveryContent>>;
}

export function createDiscoveryCache(): DiscoveryCache {
  let snapshot: Snapshot | undefined;
  return {
    async load(backend) {
      const manifest = await backend.getManifest();
      if (!manifest.ok) return { ok: false, error: manifest.error };
      if (snapshot?.hash !== manifest.value.hash) {
        let registry: RegistryMeta;
        try {
          registry = registryFromManifest(manifest.value);
        } catch (cause) {
          return {
            ok: false,
            error: `The site's component manifest is not usable: ${cause instanceof Error ? cause.message : 'unknown error'}`,
          };
        }
        snapshot = { hash: manifest.value.hash, registry, memo: new Map() };
      }
      const current = snapshot;
      return {
        ok: true,
        value: {
          registry: current.registry,
          memo(key, produce) {
            const hit = current.memo.get(key);
            if (hit !== undefined) return { ok: true, text: hit };
            const value = produce();
            if (value.ok) {
              if (current.memo.size >= MEMO_LIMIT) current.memo.clear();
              current.memo.set(key, value.text);
            }
            return value;
          },
        },
      };
    },
  };
}

/** The failure message for a tool or resource result. */
export function loadFailureText(error: McpError | string): string {
  return typeof error === 'string' ? error : error.message;
}

// --- Components ----------------------------------------------------------------------------------

/** Component categories present in the registry, sorted. */
export function componentCategories(registry: RegistryMeta): string[] {
  return [...new Set(registry.list().map((meta) => meta.category))].sort();
}

/** One line per component, grouped by category. */
export function renderComponentList(registry: RegistryMeta, category?: string): string {
  const categories = componentCategories(registry);
  if (category !== undefined && !categories.includes(category)) {
    return `Unknown category "${category}". Categories: ${categories.join(', ')}.`;
  }
  const lines: string[] = [];
  for (const cat of category === undefined ? categories : [category]) {
    lines.push(`${cat}:`);
    const metas = registry
      .list()
      .filter((meta) => meta.category === cat)
      .sort((a, b) => a.type.localeCompare(b.type));
    for (const meta of metas) {
      const note = meta.description ? ` - ${truncate(meta.description, 90)}` : '';
      const flags = [
        meta.slots === undefined ? 'leaf' : undefined,
        meta.capabilities?.insertable === false ? 'not insertable on its own' : undefined,
      ].filter((flag) => flag !== undefined);
      lines.push(
        `  ${meta.type} (${meta.label})${flags.length > 0 ? ` [${flags.join(', ')}]` : ''}${note}`,
      );
    }
  }
  lines.push('', 'Use describe_component for props, slots, rules and an example.');
  return lines.join('\n');
}

export type Rendered =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly message: string };

export function renderComponent(registry: RegistryMeta, type: string): Rendered {
  const described = describeComponent(registry, type);
  if (!described.ok) return { ok: false, message: described.error.message };
  return { ok: true, text: formatComponentDescription(described.value) };
}

// --- Templates -----------------------------------------------------------------------------------

export function renderTemplateList(registry: RegistryMeta, category?: string): string {
  const templates = registry.listTemplates();
  if (templates.length === 0) return 'This site has no templates.';
  const categories = [...new Set(templates.map((t) => t.category))].sort();
  if (category !== undefined && !categories.includes(category)) {
    return `Unknown template category "${category}". Categories: ${categories.join(', ')}.`;
  }
  const lines: string[] = [];
  for (const cat of category === undefined ? categories : [category]) {
    lines.push(`${cat}:`);
    for (const template of templates
      .filter((t) => t.category === cat)
      .sort((a, b) => a.id.localeCompare(b.id))) {
      const variants = Object.keys(template.variants ?? {});
      lines.push(
        `  ${template.id} (${template.label})${template.lock === 'structure' ? ' [structure locked]' : ''}${
          variants.length > 0 ? ` variants: ${variants.join(', ')}` : ''
        }`,
      );
    }
  }
  lines.push('', 'Use describe_template for the outline of what a template inserts.');
  return lines.join('\n');
}

/** The instantiated template as a document (its root renamed to `root`) so the outline can render it. */
export function templateOutlineDocument(
  template: TemplateDefinition,
  variant?: string,
): BuilderDocument {
  const fragment = instantiateTemplate(template, variant);
  const rootId = fragment.roots[0] as string;
  const rename = (id: string): string => (id === rootId ? 'root' : id);
  const nodes: Record<string, PageNode> = {};
  for (const node of Object.values(fragment.nodes)) {
    nodes[rename(node.id)] = {
      ...node,
      id: rename(node.id),
      ...(node.slots
        ? {
            slots: Object.fromEntries(
              Object.entries(node.slots).map(([name, ids]) => [name, ids.map(rename)]),
            ),
          }
        : {}),
    };
  }
  return { schemaVersion: 1, root: 'root', nodes, components: fragment.components };
}

export function renderTemplate(registry: RegistryMeta, id: string, variant?: string): Rendered {
  const template = registry.getTemplate(id);
  if (!template) {
    const ids = registry.listTemplates().map((t) => t.id);
    const near = nearest(id, ids);
    return {
      ok: false,
      message: `"${id}" is not a template of this site.${
        near.length > 0 ? ` Did you mean ${near.join(', ')}?` : ''
      } Templates: ${list(ids, 30) || 'none'}.`,
    };
  }
  const variants = Object.keys(template.variants ?? {});
  if (variant !== undefined && !variants.includes(variant)) {
    return {
      ok: false,
      message: `Template "${id}" has no variant "${variant}". ${
        variants.length > 0 ? `Variants: ${variants.join(', ')}.` : 'It has no variants.'
      }`,
    };
  }
  const outline = renderOutline(templateOutlineDocument(template, variant), registry, {
    depth: 12,
  });
  if (!outline.ok) return { ok: false, message: outline.error.message };
  const lines = [
    `${template.id} - ${template.label} (${template.category}, v${template.version})`,
    template.lock === 'structure'
      ? 'Lock: structure (its parts cannot be added, removed or moved after insertion, only edited).'
      : 'Lock: none.',
    `Variants: ${variants.length > 0 ? `${variants.join(', ')}${variant ? ` (showing ${variant})` : ' (showing the default)'}` : 'none'}`,
    'Outline of what it inserts (ids are minted on insertion):',
    outline.value,
  ];
  return { ok: true, text: lines.join('\n') };
}

// --- Data schema ---------------------------------------------------------------------------------

function formatType(type: DataType): string {
  switch (type.t) {
    case 'enum':
      return `enum(${type.values.map((v) => quote(v, 30)).join(' | ')})`;
    case 'list':
      return `list of ${formatType(type.of)}`;
    case 'ref':
      return `ref(${type.entity})`;
    case 'object':
      return 'object';
    default:
      return type.t;
  }
}

function fieldLines(name: string, field: DataField, depth: number, lines: string[]): void {
  const note = field.description ?? field.label;
  lines.push(
    `${'  '.repeat(depth)}${name}: ${formatType(field.type)}${field.nullable ? ' (nullable)' : ''}${
      note ? ` - ${truncate(note, 80)}` : ''
    }`,
  );
  const inner = field.type.t === 'list' ? field.type.of : field.type;
  if (inner.t === 'object' && depth < 8) {
    for (const [key, child] of Object.entries(inner.fields))
      fieldLines(key, child, depth + 1, lines);
  }
}

export function renderDataSchema(collection: string, schema: DataSchema): string {
  const lines = [
    `Data available to bindings on ${collection} documents:`,
    'Scopes (a binding path starts with one of these, e.g. page.title):',
  ];
  const scopes = Object.entries(schema.scopes);
  if (scopes.length === 0) lines.push('  none');
  for (const [name, field] of scopes) fieldLines(name, field, 1, lines);
  const entities = Object.entries(schema.entities);
  if (entities.length > 0) {
    lines.push('Entities (targets of ref(...) fields):');
    for (const [name, field] of entities) fieldLines(name, field, 1, lines);
  }
  return lines.join('\n');
}
