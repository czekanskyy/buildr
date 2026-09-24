import { revalidateTag } from 'next/cache';
import { collectionTag, docTag, globalTag, templateTag } from './tags.ts';

/** Marks a tag stale. The default is `revalidateTag`; a test (or a host with its own cache) passes another. */
export type Revalidate = (tag: string) => void;

const defaultRevalidate: Revalidate = (tag) => {
  try {
    // Next 16 takes a cache profile as the second argument, Next 15 ignores it.
    (revalidateTag as (tag: string, profile?: unknown) => void)(tag, { expire: 0 });
  } catch {
    // Outside a Next.js request (a seed script, a test) there is no cache to invalidate.
  }
};

interface DocLike {
  readonly id?: string | number;
  readonly _status?: string;
  readonly targetCollection?: string;
}

export interface HookArgs {
  readonly doc: DocLike;
  readonly previousDoc?: DocLike;
  readonly collection: { readonly slug: string };
}
export interface GlobalHookArgs {
  readonly global: { readonly slug: string };
}

export interface RevalidateHooks {
  /** For a page collection: `hooks: { afterChange: [...], afterDelete: [...] }`. */
  readonly collection: {
    readonly afterChange: readonly [(args: HookArgs) => void];
    readonly afterDelete: readonly [(args: HookArgs) => void];
  };
  /** For a global such as `site-settings`. */
  readonly global: { readonly afterChange: readonly [(args: GlobalHookArgs) => void] };
  /** For `buildr-templates`. */
  readonly templates: {
    readonly afterChange: readonly [(args: HookArgs) => void];
    readonly afterDelete: readonly [(args: HookArgs) => void];
  };
}

const published = (doc: DocLike | undefined): boolean => doc?._status === 'published';

/**
 * The Payload hooks that keep the cache honest (docs/payload.md#preview-url-and-revalidation).
 * A change counts when the document is published, or was (an unpublish, an edit of a live page);
 * a draft of a document that was never published changes nothing visitors see. A template change
 * also revalidates the collection it targets, since every page on it may have changed.
 */
export function revalidateHooks(revalidate: Revalidate = defaultRevalidate): RevalidateHooks {
  const pageChanged = (args: HookArgs) => {
    if (!(published(args.doc) || published(args.previousDoc)) || args.doc.id === undefined) return;
    revalidate(docTag(args.collection.slug, args.doc.id));
    revalidate(collectionTag(args.collection.slug));
  };
  const pageDeleted = (args: HookArgs) => {
    if (args.doc.id !== undefined) revalidate(docTag(args.collection.slug, args.doc.id));
    revalidate(collectionTag(args.collection.slug));
  };
  const templateChanged = (args: HookArgs) => {
    if (args.doc.id === undefined) return;
    revalidate(templateTag(args.doc.id));
    for (const target of [args.doc.targetCollection, args.previousDoc?.targetCollection]) {
      if (typeof target === 'string') revalidate(collectionTag(target));
    }
  };
  return {
    collection: { afterChange: [pageChanged], afterDelete: [pageDeleted] },
    global: { afterChange: [({ global }) => revalidate(globalTag(global.slug))] },
    templates: { afterChange: [templateChanged], afterDelete: [templateChanged] },
  };
}
