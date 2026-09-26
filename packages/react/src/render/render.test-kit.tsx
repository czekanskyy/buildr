// Fixtures shared by the renderer tests: a small component set, a data context and document builders.
import {
  type BuilderDocument,
  type DataContext,
  type NodeId,
  type PageNode,
  type PreparedData,
  p,
} from '@next-buildr/core';
import { createElement } from 'react';
import { defineComponent } from '../define/define-component.ts';
import { createRegistry } from '../define/registry.ts';
import type { Platform } from '../define/types.ts';
import type { RenderTreeOptions } from './types.ts';

const base = {
  version: 1,
  category: 'content',
  contentCategories: ['flow'],
  styles: { groups: [] },
} as const;

export const Page = defineComponent({
  ...base,
  type: 'buildr/page',
  label: 'Page',
  runtime: 'shared',
  props: {},
  slots: { default: {} },
  capabilities: { root: true },
  render: ({ root, children }) => <div {...root}>{children}</div>,
});

export const Section = defineComponent({
  ...base,
  type: 'buildr/section',
  label: 'Section',
  runtime: 'shared',
  props: {},
  slots: { default: {} },
  render: ({ root, children }) => <section {...root}>{children}</section>,
});

export const Heading = defineComponent({
  ...base,
  type: 'buildr/heading',
  label: 'Heading',
  runtime: 'shared',
  props: {
    text: p.text({ default: 'Heading', bindable: true }),
    level: p.number({ min: 1, max: 6, default: 2 }),
  },
  render: ({ props, root }) => createElement(`h${props.level}`, root, props.text),
});

export const Text = defineComponent({
  ...base,
  type: 'buildr/text',
  label: 'Text',
  runtime: 'shared',
  props: { text: p.text({ default: '', bindable: true }) },
  render: ({ props, root }) => <p {...root}>{props.text}</p>,
});

export const Card = defineComponent({
  ...base,
  type: 'buildr/card',
  label: 'Card',
  runtime: 'shared',
  props: {},
  slots: { header: {}, default: {}, footer: {} },
  render: ({ root, slots }) => (
    <article {...root}>
      <header>{slots['header']}</header>
      <div>{slots['default']}</div>
      <footer>{slots['footer']}</footer>
    </article>
  ),
});

export const Image = defineComponent({
  ...base,
  type: 'buildr/image',
  label: 'Image',
  runtime: 'shared',
  props: { image: p.media({ bindable: true }), alt: p.text({ default: '' }) },
  render: ({ props, root, platform }) => {
    const asset = props.image as { url: string; alt?: string } | null;
    if (typeof asset?.url !== 'string' || platform === undefined) return null;
    return <platform.Image {...root} src={asset.url} alt={props.alt || asset.alt || ''} />;
  },
});

export const Link = defineComponent({
  ...base,
  type: 'buildr/link',
  label: 'Link',
  runtime: 'shared',
  props: { label: p.text({ default: 'Link', bindable: true }), href: p.link({ default: '/' }) },
  render: ({ props, root, platform }) =>
    platform === undefined ? null : (
      <platform.Link {...root} href={props.href}>
        {props.label}
      </platform.Link>
    ),
});

export const Loop = defineComponent({
  ...base,
  type: 'buildr/loop',
  label: 'Loop',
  runtime: 'shared',
  props: { source: p.listSource(), as: p.text({ default: '' }) },
  slots: { item: {}, empty: {}, after: {} },
  render: ({ root, slots }) => (
    <div {...root}>
      {slots['item']}
      {slots['empty']}
      <footer>{slots['after']}</footer>
    </div>
  ),
});

/** Reports what it was handed, so tests can see what a client component receives. */
export const ClientProbe = defineComponent({
  ...base,
  type: 'acme/probe',
  label: 'Probe',
  runtime: 'client',
  props: { label: p.text({ default: 'probe' }) },
  render: (received) => (
    <div {...received.root} data-keys={Object.keys(received).sort().join(',')}>
      {received.props.label}
    </div>
  ),
});

export const registry = createRegistry({
  components: [Page, Section, Heading, Text, Card, Image, Link, Loop, ClientProbe],
});

export const platform: Platform = {
  Link: ({ href, children, ...rest }) => (
    <a href={href} data-platform="link" {...rest}>
      {children}
    </a>
  ),
  Image: ({ src, alt, ...rest }) => <img src={src} alt={alt} data-platform="image" {...rest} />,
  formAction: (ref, nodeId) => `/forms/${ref}/${nodeId}`,
};

export function dataContext(
  scopes: DataContext['scopes'] = {},
  locale = 'en',
  fallback = true,
): DataContext {
  return {
    scopes,
    locale,
    locales: { default: 'en', fallback, intl: { en: 'English', pl: 'Polski' } },
    timeZone: 'UTC',
    mode: 'production',
  };
}

export const emptyData: PreparedData = {
  media: {},
  queries: {},
  collectionsUsed: [],
  diagnostics: [],
};

export function options(overrides: Partial<RenderTreeOptions> = {}): RenderTreeOptions {
  return { registry, data: emptyData, context: dataContext(), platform, ...overrides };
}

export const ID = (n: number): NodeId => `node${String(n).padStart(6, '0')}`;

/** Nodes with their children by id; the first node is the root's only child unless `top` says otherwise. */
export function doc(
  nodes: readonly PageNode[],
  kids: Readonly<Record<NodeId, readonly NodeId[]>> = {},
  top?: readonly NodeId[],
): BuilderDocument {
  const byId: Record<string, PageNode> = {};
  const components: Record<string, number> = { 'buildr/page': 1 };
  for (const node of nodes) {
    const children = kids[node.id];
    byId[node.id] = children ? { ...node, slots: { ...node.slots, default: children } } : node;
    components[node.type] = 1;
  }
  const child = new Set(Object.values(kids).flat());
  const roots = top ?? nodes.filter((n) => !child.has(n.id)).map((n) => n.id);
  byId['root'] = { id: 'root', type: 'buildr/page', slots: { default: roots } };
  return { schemaVersion: 1, root: 'root', nodes: byId, components };
}

export const node = (
  i: number,
  type: string,
  props: PageNode['props'] = {},
  extra: Partial<PageNode> = {},
): PageNode => ({
  id: ID(i),
  type,
  ...(Object.keys(props).length > 0 ? { props } : {}),
  ...extra,
});
