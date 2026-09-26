import { defaultTemplates } from '@next-buildr/components';
import {
  type BuilderDocument,
  type BuilderFragment,
  createSeededIdGenerator,
  instantiateTemplate,
  type PageNode,
  s,
  type TemplateDefinition,
  type Value,
} from '@next-buildr/core';
import { COPY } from './copy.ts';

/** A media library entry as a page refers to it. */
export interface SeedMedia {
  readonly id: string;
  readonly url: string;
  readonly alt: { readonly pl: string; readonly en: string };
  readonly width: number;
  readonly height: number;
}

export interface SeedDocuments {
  /** `pages` documents by slug. */
  readonly pages: Readonly<Record<'home' | 'about' | 'blog' | 'contact', BuilderDocument>>;
  /** `buildr-templates` documents: the default layout of every post and every product. */
  readonly templates: Readonly<Record<'post' | 'product', BuilderDocument>>;
}

const template = (id: string): TemplateDefinition => {
  const found = defaultTemplates.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Unknown template "${id}"`);
  return found;
};

type StaticText = { kind: 'static'; value: string };
const isText = (value: Value): value is StaticText =>
  value.kind === 'static' && typeof (value as { value?: unknown }).value === 'string';

/** Words in the stored language (Polish) with the English one carried as `l10n.en`. */
function localize(node: PageNode): PageNode {
  if (node.props === undefined) return node;
  const props: Record<string, Value> = {};
  for (const [name, value] of Object.entries(node.props)) {
    const copy = isText(value) ? COPY[value.value] : undefined;
    props[name] =
      copy === undefined
        ? value
        : s(copy.pl, { l10n: { en: copy.en ?? (value as StaticText).value } });
  }
  return { ...node, props };
}

interface PageInput {
  readonly parts: readonly { readonly id: string; readonly variant?: string }[];
  /** Fills the pictures of the sections (`buildr/image` without a binding), in order. */
  readonly pictures?: readonly SeedMedia[];
  /** Deterministic ids: the same seed always yields the same document. */
  readonly seed: string;
}

function compose(input: PageInput): BuilderDocument {
  const idGen = createSeededIdGenerator(`example-next-payload/${input.seed}`);
  const rootNode: PageNode = { id: 'root', type: 'buildr/page' };
  const nodes: Record<string, PageNode> = {};
  const components: Record<string, number> = { 'buildr/page': 1 };
  const roots: string[] = [];
  const pictures = [...(input.pictures ?? [])];

  for (const part of input.parts) {
    const fragment: BuilderFragment = instantiateTemplate(template(part.id), part.variant, idGen);
    roots.push(...fragment.roots);
    Object.assign(components, fragment.components);
    for (const [id, node] of Object.entries(fragment.nodes)) {
      let next = localize(node);
      const unbound = next.type === 'buildr/image' && next.props?.['image'] === undefined;
      const picture = unbound ? pictures.shift() : undefined;
      if (picture !== undefined) {
        next = {
          ...next,
          props: {
            ...next.props,
            image: s({
              source: 'payload',
              collection: 'media',
              id: picture.id,
              snapshot: {
                url: picture.url,
                alt: picture.alt.pl,
                width: picture.width,
                height: picture.height,
                mimeType: 'image/svg+xml',
              },
            }),
            alt: s(picture.alt.pl, { l10n: { en: picture.alt.en } }),
          },
        } as PageNode;
      }
      nodes[id] = next;
    }
  }
  return {
    schemaVersion: 1,
    root: 'root',
    components,
    nodes: { root: { ...rootNode, slots: { default: roots } }, ...nodes },
  };
}

/** The contact template opens with an H2 (it is meant to sit inside a page); as the whole page its heading is the H1. */
function withH1(doc: BuilderDocument): BuilderDocument {
  const first = Object.values(doc.nodes).find((node) => node.type === 'buildr/heading');
  if (first === undefined) return doc;
  const nodes = { ...doc.nodes, [first.id]: { ...first, props: { ...first.props, level: s(1) } } };
  return { ...doc, nodes };
}

/** The six scenarios: a landing page, a company page, a blog post (its template), the listing, a product (its template) and a contact page. */
export function buildSeedDocuments(media: { readonly team: SeedMedia }): SeedDocuments {
  return {
    pages: {
      home: compose({
        seed: 'home',
        parts: [
          { id: 'buildr/hero', variant: 'centered' },
          { id: 'buildr/feature-grid' },
          { id: 'buildr/testimonial' },
          { id: 'buildr/cta' },
        ],
      }),
      about: compose({
        seed: 'about',
        pictures: [media.team],
        parts: [
          { id: 'buildr/hero', variant: 'imageRight' },
          { id: 'buildr/pricing' },
          { id: 'buildr/faq' },
          { id: 'buildr/cta' },
        ],
      }),
      blog: compose({ seed: 'blog', parts: [{ id: 'buildr/blog-listing' }] }),
      contact: withH1(compose({ seed: 'contact', parts: [{ id: 'buildr/contact' }] })),
    },
    templates: {
      post: compose({
        seed: 'post-template',
        parts: [
          { id: 'buildr/post-header' },
          { id: 'buildr/post-content' },
          { id: 'buildr/author-box' },
        ],
      }),
      product: compose({
        seed: 'product-template',
        parts: [{ id: 'buildr/product-hero' }, { id: 'buildr/product-details' }],
      }),
    },
  };
}
