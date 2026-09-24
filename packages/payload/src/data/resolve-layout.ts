import type { Payload, PayloadRequest, Where } from 'payload';

/** The collection of reusable layouts (added by the plugin). */
export const TEMPLATES_COLLECTION = 'buildr-templates';

/** Where the layout of a document came from, in the order `resolveLayout` tries them. */
export type LayoutSource = 'document' | 'template' | 'default-template' | 'builtin';

export interface ResolvedLayout {
  /** The stored layout as it is (not migrated or validated), or the built-in one. */
  readonly layout: unknown;
  readonly source: LayoutSource;
  /**
   * The document the layout came from as `{collection}:{id}` (the `layoutRef` forms and cache tags
   * use); `null` for the built-in layout, which belongs to no document.
   */
  readonly layoutRef: string | null;
}

export interface ResolveLayoutInput {
  readonly payload: Payload;
  /** The request whose access applies; without one the read is the visitor's (anonymous). */
  readonly req?: PayloadRequest | undefined;
  readonly collection: string;
  /** The document: at least `id`, `layout` and `template` (an id or a populated template). */
  readonly doc: Readonly<Record<string, unknown>>;
  /** The name the document is bound under (`post`, `page`): the built-in layout binds to it. */
  readonly contextName: string;
  /** Read the latest draft of the templates (the editor, a preview) instead of the published ones. */
  readonly draft?: boolean | undefined;
  /** `true` skips collection access: for a trusted server-side render. Default `false`. */
  readonly overrideAccess?: boolean | undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A layout has content when its root has at least one child; a bare root is what "no layout" looks like. */
export function hasContent(layout: unknown): boolean {
  if (!isRecord(layout) || !isRecord(layout['nodes'])) return false;
  const root = layout['nodes']['root'];
  if (!isRecord(root) || !isRecord(root['slots'])) return false;
  return Object.values(root['slots']).some(
    (children) => Array.isArray(children) && children.length > 0,
  );
}

const idOf = (value: unknown): string | number | undefined => {
  const id = isRecord(value) ? value['id'] : value;
  return typeof id === 'string' || typeof id === 'number' ? id : undefined;
};

/**
 * The built-in minimal layout (title and body) a document falls back to when neither it nor a
 * template has one: a level-1 heading bound to `{context}.title` and a rich text bound to
 * `{context}.content`.
 */
export function builtinLayout(contextName: string): unknown {
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: ['bTitle0001', 'bBody00001'] } },
      bTitle0001: {
        id: 'bTitle0001',
        type: 'buildr/heading',
        name: 'Title',
        props: {
          text: { kind: 'binding', path: `${contextName}.title` },
          level: { kind: 'static', value: 1 },
        },
      },
      bBody00001: {
        id: 'bBody00001',
        type: 'buildr/rich-text',
        name: 'Body',
        props: { content: { kind: 'binding', path: `${contextName}.content` } },
      },
    },
    components: { 'buildr/page': 1, 'buildr/heading': 1, 'buildr/rich-text': 1 },
  };
}

/**
 * The layout a document is shown with (docs/payload.md): its own (`layout`, when it has content),
 * else the template it points at, else the collection's default template (`isDefault`), else the
 * built-in minimal one. A template of another collection is never used. Unless `draft`, only
 * published templates count.
 */
export async function resolveLayout(input: ResolveLayoutInput): Promise<ResolvedLayout> {
  const { payload, collection, doc } = input;
  const ownId = idOf(doc['id']);
  if (hasContent(doc['layout'])) {
    return {
      layout: doc['layout'],
      source: 'document',
      layoutRef: ownId === undefined ? null : `${collection}:${String(ownId)}`,
    };
  }

  if (payload.collections[TEMPLATES_COLLECTION as never] === undefined) {
    return { layout: builtinLayout(input.contextName), source: 'builtin', layoutRef: null };
  }

  const access = {
    draft: input.draft === true,
    overrideAccess: input.overrideAccess === true,
    depth: 0,
    ...(input.req === undefined ? {} : { req: input.req }),
  };
  const asResolved = (
    template: Record<string, unknown> | undefined,
    source: 'template' | 'default-template',
  ): ResolvedLayout | undefined => {
    if (template === undefined || template['targetCollection'] !== collection) return undefined;
    if (input.draft !== true && template['_status'] !== 'published') return undefined;
    if (!hasContent(template['layout'])) return undefined;
    return {
      layout: template['layout'],
      source,
      layoutRef: `${TEMPLATES_COLLECTION}:${String(template['id'])}`,
    };
  };

  const templateId = idOf(doc['template']);
  if (templateId !== undefined) {
    const found = await payload
      .findByID({ collection: TEMPLATES_COLLECTION, id: templateId, ...access })
      .catch(() => undefined);
    const own = asResolved(found as unknown as Record<string, unknown> | undefined, 'template');
    if (own !== undefined) return own;
  }
  const defaults = await payload.find({
    collection: TEMPLATES_COLLECTION,
    where: {
      and: [
        { targetCollection: { equals: collection } },
        { isDefault: { equals: true } },
        ...(input.draft === true ? [] : [{ _status: { equals: 'published' } } as Where]),
      ],
    },
    limit: 1,
    pagination: false,
    ...access,
  });
  const fallback = asResolved(
    defaults.docs[0] as unknown as Record<string, unknown> | undefined,
    'default-template',
  );
  if (fallback !== undefined) return fallback;

  return { layout: builtinLayout(input.contextName), source: 'builtin', layoutRef: null };
}
