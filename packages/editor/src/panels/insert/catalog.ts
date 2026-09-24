import type { ComponentMeta, RegistryManifest, TemplateDefinition } from '@buildr/core';

export interface PaletteItem {
  readonly kind: 'component' | 'template';
  /** The component type or the template id. */
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly description: string | undefined;
  readonly icon: string | undefined;
  readonly thumbnail: string | undefined;
  /** What the search looks at, lower-cased. */
  readonly haystack: string;
}

export interface PaletteGroup {
  readonly category: string;
  readonly items: readonly PaletteItem[];
}

function componentItem(meta: ComponentMeta): PaletteItem {
  return {
    kind: 'component',
    id: meta.type,
    label: meta.label,
    category: meta.category,
    description: meta.description,
    icon: meta.icon,
    thumbnail: undefined,
    haystack: [meta.label, meta.type, meta.description ?? '', ...(meta.keywords ?? [])]
      .join(' ')
      .toLowerCase(),
  };
}

function templateItem(template: TemplateDefinition): PaletteItem {
  return {
    kind: 'template',
    id: template.id,
    label: template.label,
    category: template.category,
    description: undefined,
    icon: undefined,
    thumbnail: template.thumbnail,
    haystack: [template.label, template.id, template.category].join(' ').toLowerCase(),
  };
}

/** A thumbnail is shown only when it is an address of an image, never anything a page could run. */
export function safeThumbnail(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return /^(https?:\/\/|\/(?!\/)|data:image\/(png|jpe?g|gif|webp|avif);)/i.test(value)
    ? value
    : undefined;
}

/** Components that can be inserted (not root-only, not `insertable: false`) and templates, from the manifest. */
export function paletteItems(manifest: RegistryManifest): {
  readonly components: readonly PaletteItem[];
  readonly templates: readonly PaletteItem[];
} {
  const byLabel = (a: PaletteItem, b: PaletteItem) => a.label.localeCompare(b.label);
  return {
    components: Object.values(manifest.components)
      .filter((meta) => meta.capabilities?.insertable !== false && meta.capabilities?.root !== true)
      .map(componentItem)
      .sort(byLabel),
    templates: Object.values(manifest.templates).map(templateItem).sort(byLabel),
  };
}

/** The items whose label, type, description or keywords contain every word of `query`. */
export function filterItems(items: readonly PaletteItem[], query: string): PaletteItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => words.every((word) => item.haystack.includes(word)));
}

export function groupByCategory(items: readonly PaletteItem[]): PaletteGroup[] {
  const groups = new Map<string, PaletteItem[]>();
  for (const item of items) {
    const list = groups.get(item.category);
    if (list === undefined) groups.set(item.category, [item]);
    else list.push(item);
  }
  return [...groups].map(([category, list]) => ({ category, items: list }));
}
