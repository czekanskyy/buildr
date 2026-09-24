// Shared fixtures for the command handler tests. Not part of the package (see tsconfig `exclude`).
import type { BuilderFragment } from '../../document/fragment.ts';
import type { BuilderDocument, ComponentType, NodeId, PageNode } from '../../document/types.ts';
import { createSeededIdGenerator } from '../../ids/seeded-id-generator.ts';
import type { ComponentMeta } from '../../registry/meta.ts';
import { createRegistryMeta } from '../../registry/registry.ts';
import { p } from '../../schema/p.ts';
import { createCommandRegistry } from '../registry.ts';
import type { Command, CommandEnv, CommandHandler } from '../types.ts';
import { coreCommandHandlers } from './index.ts';

function component(type: ComponentType, overrides: Partial<ComponentMeta> = {}): ComponentMeta {
  return {
    type,
    version: 1,
    label: type.replace('buildr/', ''),
    category: 'content',
    props: {},
    contentCategories: ['flow'],
    styles: { groups: [] },
    runtime: 'shared',
    ...overrides,
  };
}

export const registry = createRegistryMeta({
  components: [
    component('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
    component('buildr/section', { slots: { default: {} } }),
    component('buildr/heading', {
      contentCategories: ['flow', 'phrasing'],
      props: {
        title: p.text({ maxLength: 20 }),
        level: p.number({ min: 1, max: 6, default: 1 }),
        code: p.text({ localizable: false }),
        plain: p.text({ bindable: false }),
      },
    }),
    component('buildr/card', { slots: { default: {} }, props: { title: p.text() } }),
    component('buildr/boxes', { slots: { default: { allow: ['buildr/textbox'] } } }),
    component('buildr/textbox', { slots: { default: { allow: ['buildr/text'] } } }),
    component('buildr/list', { slots: { default: { min: 1 } } }),
    component('buildr/pair', { slots: { default: { max: 2 } } }),
    component('buildr/text', { contentCategories: ['flow', 'phrasing'] }),
    component('buildr/sticky', { capabilities: { removable: false } }),
    component('buildr/hidden', { capabilities: { insertable: false } }),
  ],
});

export function createEnv(handlers: readonly CommandHandler[] = coreCommandHandlers): CommandEnv {
  return {
    registry,
    commands: createCommandRegistry(handlers),
    generateId: createSeededIdGenerator(7),
  };
}

export const env = createEnv();

export function node(
  id: NodeId,
  type: ComponentType,
  children?: readonly NodeId[],
  extra: Partial<PageNode> = {},
): PageNode {
  return {
    id,
    type,
    ...(children !== undefined ? { slots: { default: children } } : {}),
    ...extra,
  };
}

/** A document whose root holds `rootChildren`; `nodes` are every other node. */
export function buildDoc(
  nodes: readonly PageNode[],
  rootChildren: readonly NodeId[],
): BuilderDocument {
  const map: Record<NodeId, PageNode> = { root: node('root', 'buildr/page', rootChildren) };
  const components: Record<string, number> = { 'buildr/page': 1 };
  for (const n of nodes) {
    map[n.id] = n;
    components[n.type] = 1;
  }
  return { schemaVersion: 1, root: 'root', nodes: map, components };
}

/** A fragment of `roots`; `nodes` holds every node in it, roots included. */
export function fragment(nodes: readonly PageNode[], roots: readonly NodeId[]): BuilderFragment {
  const components: Record<string, number> = {};
  const map: Record<NodeId, PageNode> = {};
  for (const n of nodes) {
    map[n.id] = n;
    components[n.type] = 1;
  }
  return { format: 'buildr/fragment', schemaVersion: 1, components, roots, nodes: map };
}

export const cmd = <T extends string, P>(type: T, payload: P): Command<T, P> => ({
  type,
  payload,
});

export const snapshot = (doc: BuilderDocument): string => JSON.stringify(doc);

/** Ten-character ids matching the random-id pattern, for fragments. */
export const ID = (n: number): NodeId => `frag${String(n).padStart(6, '0')}`;
