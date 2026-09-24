// Generators for the property-based command tests. Not part of the package (see tsconfig `exclude`).
//
// Commands are generated *against the current document* from a small tuple of random numbers
// (a "choice"), so most of them reference real nodes and get accepted while a healthy share is
// deliberately invalid. The choice tuple shrinks to something readable, and a failing sequence is
// just a list of choices — easy to pin as a regression test.
import fc from 'fast-check';
import { createIndex } from '../../document/document-index.ts';
import type { BuilderFragment } from '../../document/fragment.ts';
import type { BuilderDocument, NodeId, PageNode } from '../../document/types.ts';
import { createSeededIdGenerator } from '../../ids/seeded-id-generator.ts';
import { bind, expr, s } from '../../values/helpers.ts';
import { createEnv, registry } from '../handlers/handlers.test-kit.ts';
import type { Command, CommandEnv } from '../types.ts';

export interface Choice {
  readonly kind: number;
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly text: string;
}

export const choiceArb: fc.Arbitrary<Choice> = fc.record({
  kind: fc.nat(99),
  a: fc.nat(1000),
  b: fc.nat(1000),
  c: fc.nat(1000),
  d: fc.nat(1000),
  text: fc.string({ maxLength: 6 }),
});

export const choicesArb = (maxLength = 14) => fc.array(choiceArb, { minLength: 1, maxLength });

/** Runs a property this many times; CI uses the default, the nightly run raises it. */
export const NUM_RUNS = Number(process.env.FC_NUM_RUNS ?? 1000);

const pick = <T>(list: readonly T[], n: number): T => list[n % list.length] as T;

const COMPONENTS = [
  'buildr/text',
  'buildr/section',
  'buildr/card',
  'buildr/pair',
  'buildr/textbox',
  'buildr/list',
  'buildr/heading',
  'buildr/sticky',
  'buildr/hidden',
  'acme/unknown',
];
const WRAPPERS = ['buildr/section', 'buildr/card', 'buildr/textbox', 'buildr/pair', 'buildr/text'];
const CONTAINERS = new Set([
  'buildr/section',
  'buildr/card',
  'buildr/pair',
  'buildr/textbox',
  'buildr/list',
]);

/** The starting document: a small but varied tree. */
export function startDoc(): BuilderDocument {
  const node = (id: string, type: string, children?: string[]): PageNode => ({
    id,
    type,
    ...(children ? { slots: { default: children } } : {}),
  });
  const nodes = [
    node('Sec0000001', 'buildr/section', ['Txt0000001', 'Crd0000001', 'Txt0000002']),
    node('Txt0000001', 'buildr/text'),
    node('Crd0000001', 'buildr/card', ['Txt0000003', 'Hdg0000001']),
    node('Txt0000003', 'buildr/text'),
    node('Hdg0000001', 'buildr/heading'),
    node('Txt0000002', 'buildr/text'),
    node('Sec0000002', 'buildr/section', []),
  ];
  const map: Record<string, PageNode> = {
    root: node('root', 'buildr/page', ['Sec0000001', 'Sec0000002']),
  };
  const components: Record<string, number> = { 'buildr/page': 1 };
  for (const n of nodes) {
    map[n.id] = n;
    components[n.type] = 1;
  }
  return { schemaVersion: 1, root: 'root', nodes: map, components };
}

/** A fresh command environment; unlocking is permitted so lock commands can be exercised both ways. */
export function propertyEnv(seed = 1): CommandEnv {
  return { ...createEnv(), generateId: createSeededIdGenerator(seed), canUnlock: () => true };
}

function fragmentFor(choice: Choice, ids: () => string): BuilderFragment {
  const type = pick(COMPONENTS, choice.c);
  const rootId = ids();
  const nodes: Record<string, PageNode> = {};
  const components: Record<string, number> = { [type]: 1 };
  if (CONTAINERS.has(type)) {
    const children: string[] = [];
    for (let i = 0; i < choice.d % 3; i++) {
      const childId = ids();
      nodes[childId] = { id: childId, type: 'buildr/text' };
      children.push(childId);
      components['buildr/text'] = 1;
    }
    nodes[rootId] = { id: rootId, type, slots: { default: children } };
  } else {
    nodes[rootId] = { id: rootId, type };
  }
  return { format: 'buildr/fragment', schemaVersion: 1, components, roots: [rootId], nodes };
}

const STYLES: readonly (readonly [string, string, unknown])[] = [
  ['layout', 'display', 'flex'],
  ['layout', 'display', 'grid'],
  ['layout', 'gap', '$space.4'],
  ['layout', 'gap', '1rem'],
  ['spacing', 'padding', '2rem'],
  ['typography', 'color', '$color.primary'],
  ['effects', 'opacity', 0.5],
  ['visibility', 'hidden', true],
  // deliberately invalid
  ['layout', 'gap', 'url(x)'],
  ['layout', 'nope', '1px'],
  ['layout', 'display', 'bogus'],
];

function styleCommand(id: NodeId, choice: Choice): Command {
  const [group, property, value] = pick(STYLES, choice.b);
  const layer = pick([{}, { bp: 'tablet' }, { bp: 'mobile' }, { state: 'hover' }], choice.c);
  const kind = choice.kind % 100;
  const boxed = group === 'spacing';
  const side = boxed ? { side: pick(['top', 'left', 'bottom'], choice.d) } : {};
  if (kind < 80)
    return { type: 'node.setStyle', payload: { id, layer, group, property, value, ...side } };
  if (kind < 84)
    return { type: 'node.unsetStyle', payload: { id, layer, group, property, ...side } };
  return { type: 'node.resetStyles', payload: { id, ...(choice.d % 2 === 0 ? { layer } : {}) } };
}

function propCommand(doc: BuilderDocument, id: NodeId, choice: Choice): Command {
  const type = doc.nodes[id]?.type ?? '';
  const props = Object.keys(registry.get(type)?.props ?? {});
  const prop = props.length > 0 ? pick(props, choice.b) : 'title';
  if (choice.kind % 100 >= 67) {
    return {
      type: 'node.unsetProp',
      payload: { id, prop, ...(choice.d % 3 === 0 ? { locale: 'pl' } : {}) },
    };
  }
  const value = pick(
    [
      s(choice.text),
      s(choice.c % 7),
      s(choice.text, { l10n: { pl: choice.text } }),
      bind('post.title'),
      expr('1 + 1'),
      s(true),
    ],
    choice.c,
  );
  return {
    type: 'node.setProp',
    payload: { id, prop, value, ...(choice.d % 4 === 0 ? { locale: 'pl' } : {}) },
  };
}

function attrCommand(id: NodeId, choice: Choice): Command {
  if (choice.kind % 100 >= 96) {
    const lock = pick(
      [null, {}, { structure: true }, { content: true }, { structure: true, style: true }],
      choice.b,
    );
    return { type: 'node.setAttr', payload: { id, key: 'lock', value: lock } };
  }
  const which = choice.b % 4;
  if (which === 0)
    return { type: 'node.setAttr', payload: { id, key: 'name', value: choice.text || null } };
  if (which === 1) {
    return {
      type: 'node.setAttr',
      payload: { id, key: 'anchor', value: pick(['a', 'b', 'hero', null, 'Bad Anchor'], choice.c) },
    };
  }
  if (which === 2)
    return {
      type: 'node.setAttr',
      payload: { id, key: 'region', value: pick(['actions', null], choice.c) },
    };
  return {
    type: 'node.setAttr',
    payload: {
      id,
      key: 'visibleIf',
      value: pick([bind('flag'), expr('count > 1'), null, s(true)], choice.c),
    },
  };
}

/**
 * Turns a choice into a command against `doc`. `ids` mints node ids for inserted fragments (a
 * counter, so they never collide with each other; collisions with the document are handled by
 * the command itself).
 */
export function commandFor(doc: BuilderDocument, choice: Choice, ids: () => string): Command {
  const order = createIndex(doc).order;
  const index = createIndex(doc);
  const node = pick(order, choice.a);
  const kind = choice.kind % 100;

  if (kind < 20) {
    const parent = pick(order, choice.a);
    const length = doc.nodes[parent]?.slots?.default?.length ?? 0;
    return {
      type: 'node.insert',
      payload: {
        parentId: parent,
        slot: 'default',
        index: choice.b % (length + 1),
        fragment: fragmentFor(choice, ids),
      },
    };
  }
  if (kind < 28) {
    const other = pick(order, choice.b);
    return { type: 'node.remove', payload: { ids: choice.d % 3 === 0 ? [node, other] : [node] } };
  }
  if (kind < 40) {
    const parent = pick(order, choice.b);
    const length = doc.nodes[parent]?.slots?.default?.length ?? 0;
    const siblings =
      index.parentOf[node] !== undefined
        ? (doc.nodes[index.parentOf[node] as string]?.slots?.default ?? [])
        : [];
    const at = siblings.indexOf(node);
    const moving =
      choice.d % 3 === 0 && at >= 0 && siblings[at + 1] !== undefined
        ? [node, siblings[at + 1] as string]
        : [node];
    return {
      type: 'node.move',
      payload: { ids: moving, parentId: parent, slot: 'default', index: choice.c % (length + 2) },
    };
  }
  if (kind < 47)
    return {
      type: 'node.duplicate',
      payload: { ids: choice.d % 3 === 0 ? [node, pick(order, choice.b)] : [node] },
    };
  if (kind < 55) {
    const siblings =
      index.parentOf[node] !== undefined
        ? (doc.nodes[index.parentOf[node] as string]?.slots?.default ?? [])
        : [];
    const at = siblings.indexOf(node);
    const span = 1 + (choice.d % 3);
    const ids = at >= 0 ? siblings.slice(at, at + span) : [node];
    return { type: 'node.wrap', payload: { ids, wrapper: { type: pick(WRAPPERS, choice.c) } } };
  }
  if (kind < 61) return { type: 'node.unwrap', payload: { id: node } };
  if (kind < 70) return propCommand(doc, node, choice);
  if (kind < 86) return styleCommand(node, choice);
  return attrCommand(node, choice);
}

/** Feeds `commandFor` one choice at a time, threading the document through. */
export function idCounter(prefix = 'Gen'): () => string {
  let n = 0;
  return () => `${prefix}${String(++n).padStart(7, '0')}`;
}
