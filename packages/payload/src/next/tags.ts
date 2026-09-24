/** The cache tag convention (docs/nextjs.md#preview--draft-mode-caching-revalidation-errors). */
export const THEME_TAG = 'buildr:theme';

export const docTag = (collection: string, id: string | number): string =>
  `buildr:doc:${collection}:${String(id)}`;
export const collectionTag = (collection: string): string => `buildr:col:${collection}`;
export const globalTag = (slug: string): string => `buildr:global:${slug}`;
export const templateTag = (id: string | number): string => `buildr:template:${String(id)}`;

export interface TagInput {
  readonly collection: string;
  readonly id?: string | number | undefined;
  /** `{collection}:{id}` of the document the layout came from; a template adds its own tag. */
  readonly layoutRef?: string | null | undefined;
  /** The collections a Loop or query read (`collectionsUsed` of the render). */
  readonly collectionsUsed?: readonly string[] | undefined;
  /** Globals the page reads (`site-settings`). */
  readonly globals?: readonly string[] | undefined;
}

/**
 * Every tag a rendered page depends on: its document, its collection (a slug lookup may resolve
 * to another document after any change), the template its layout came from, the collections its
 * queries read, the globals it reads and the theme. Sorted and free of duplicates.
 */
export function tagsFor(input: TagInput): string[] {
  const tags = new Set<string>([THEME_TAG, collectionTag(input.collection)]);
  if (input.id !== undefined) tags.add(docTag(input.collection, input.id));
  const ref = input.layoutRef;
  if (typeof ref === 'string') {
    const at = ref.indexOf(':');
    const owner = ref.slice(0, at);
    const id = ref.slice(at + 1);
    if (owner === 'buildr-templates') tags.add(templateTag(id));
    else if (at > 0) tags.add(docTag(owner, id));
  }
  for (const used of input.collectionsUsed ?? []) tags.add(collectionTag(used));
  for (const slug of input.globals ?? []) tags.add(globalTag(slug));
  return [...tags].sort();
}
