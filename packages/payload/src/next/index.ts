// @next-buildr/payload/next: getBuildrDocument, listPublishedSlugs, revalidateHooks, the cache tag
// convention and the SEO mapping. Imports `next/cache`, so use it from server code of a Next.js app.
export type {
  BuildrDocumentEntry,
  CacheRead,
  GetBuildrDocumentInput,
  ListPublishedSlugsInput,
} from './get-document.ts';
export { getBuildrDocument, listPublishedSlugs } from './get-document.ts';
export type { GlobalHookArgs, HookArgs, Revalidate, RevalidateHooks } from './revalidate.ts';
export { revalidateHooks } from './revalidate.ts';
export type { SeoEntry, SeoOptions } from './seo.ts';
export { alternatesOf, seoFromDocument } from './seo.ts';
export type { TagInput } from './tags.ts';
export {
  collectionTag,
  docTag,
  globalTag,
  THEME_TAG,
  tagsFor,
  templateTag,
} from './tags.ts';
