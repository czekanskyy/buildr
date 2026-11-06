import type { ComponentMeta, RegistryManifest, TemplateDefinition } from '@next-buildr/core';

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
  if (value.startsWith('data:image/svg+xml,')) {
    try {
      const svg = decodeURIComponent(value.slice('data:image/svg+xml,'.length));
      // Only the manifest wireframe generator's fixed SVG vocabulary is accepted.
      return /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' viewBox='0 0 160 100'>(?:<path fill='#[0-9a-f]{6}' d='[M0-9 .h/vz-]+'\/>)*<\/svg>$/i.test(
        svg,
      )
        ? value
        : undefined;
    } catch {
      return undefined;
    }
  }
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

/** The blocks of the "Basic" group, in this order; those the registry lacks are left out. */
export const BASIC_TYPES: readonly string[] = [
  'buildr/heading',
  'buildr/text',
  'buildr/button',
  'buildr/image',
  'buildr/list',
  'buildr/quote',
];

/** What "Recently used" shows until something was used: the first three basic blocks. */
export const DEFAULT_RECENT: readonly string[] = BASIC_TYPES.slice(0, 3);

/** Moves the basic blocks out of their categories into a "basic" group at the top. */
export function withBasicGroup(groups: readonly PaletteGroup[]): PaletteGroup[] {
  const all = groups.flatMap((group) => group.items);
  const basic = BASIC_TYPES.flatMap((type) => all.find((item) => item.id === type) ?? []);
  if (basic.length === 0) return [...groups];
  const taken = new Set(basic.map((item) => item.id));
  return [
    { category: 'basic', items: basic },
    ...groups
      .map((group) => ({ ...group, items: group.items.filter((item) => !taken.has(item.id)) }))
      .filter((group) => group.items.length > 0),
  ];
}

/** The order categories appear in; a category this list does not know follows, alphabetically. */
export const CATEGORY_ORDER: readonly string[] = [
  'layout',
  'content',
  'media',
  'forms',
  'ui',
  'cms',
];

const categoryRank = (category: string): number => {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
};

export function groupByCategory(items: readonly PaletteItem[]): PaletteGroup[] {
  const groups = new Map<string, PaletteItem[]>();
  for (const item of items) {
    const list = groups.get(item.category);
    if (list === undefined) groups.set(item.category, [item]);
    else list.push(item);
  }
  return [...groups]
    .map(([category, list]) => ({ category, items: list }))
    .sort(
      (a, b) =>
        categoryRank(a.category) - categoryRank(b.category) || a.category.localeCompare(b.category),
    );
}
