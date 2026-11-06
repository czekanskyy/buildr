import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../document/create.ts';
import {
  canvasMessageSchema,
  createMessage,
  editorMessageSchema,
  MAX_HIDDEN_NODES,
  MAX_PATCH_PATH,
  MAX_PATCHES,
  MAX_SELECTION,
  MAX_TYPE_LABELS,
  MAX_VIEW_LABEL_LENGTH,
  MESSAGE_DIRECTION,
  MESSAGE_TYPES,
  type MessageType,
  messageSchema,
  type PayloadOf,
  PROTOCOL_SOURCE,
  PROTOCOL_VERSION,
  parseCanvasMessage,
  parseEditorMessage,
  parseEnvelope,
  parseMessage,
  viewLabelsSchema,
} from './index.ts';

const SESSION = 'abcDEF0123456789_-xyz';
const ID = 'AbCdEfGhIj';
const ID2 = 'KlMnOpQrSt';
const doc = createEmptyDocument();
const mods = { shift: false, alt: false, ctrl: true, meta: false };
const viewport = { breakpoint: 'tablet', width: 768 };
const locales = {
  locales: ['pl', 'en'],
  default: 'pl',
  fallback: true,
  intl: { pl: 'Polski', en: 'English' },
};
const target = { parentId: 'root', slot: 'default', index: 0 };

/** A valid payload for every type: one place to see what each message looks like. */
const valid: { [T in MessageType]: PayloadOf<T> } = {
  'editor:init': {
    doc,
    docVersion: 0,
    selection: [ID],
    viewport,
    contextRef: 'posts:1',
    locale: 'pl',
    locales,
    mode: 'edit',
  },
  'doc:patch': {
    from: 3,
    to: 4,
    patches: [
      {
        op: 'replace',
        path: ['nodes', ID, 'props', 'text'],
        value: { kind: 'static', value: 'x' },
      },
      { op: 'add', path: ['nodes', ID2], value: { id: ID2, type: 'buildr/text' } },
      { op: 'remove', path: ['nodes', ID, 'slots', 'default', 0] },
    ],
  },
  'doc:set': { doc, docVersion: 7 },
  'selection:set': { ids: [ID, ID2] },
  'hover:set': { id: ID },
  'viewport:set': viewport,
  'context:set': { contextRef: null },
  'locale:set': { locale: 'en' },
  'dnd:over': { point: { x: 10.5, y: -4 }, item: { kind: 'component', type: 'buildr/text' } },
  'dnd:leave': {},
  'scroll:to': { id: ID },
  'mode:set': { mode: 'interact' },
  'view:set': { outlines: true, hidden: [ID], theme: 'dark', labels: { toolbar: 'Block tools' } },
  ping: {},
  'canvas:hello': { protocol: PROTOCOL_VERSION, rendererVersion: '0.1.0', manifestHash: 'abc123' },
  'canvas:ready': {},
  'doc:resync-request': { have: 5 },
  'node:click': { id: ID, instance: 'loop1:2', modifiers: mods },
  'node:hover': { id: null, modifiers: mods },
  'node:dblclick': { id: ID, modifiers: mods },
  'inline:commit': { id: ID, prop: 'text', value: 'Hello' },
  'dnd:target': {
    target: null,
    reason: { code: 'slot-denied', message: 'Not allowed here', params: { slot: 'default' } },
  },
  'intent:move': { ids: [ID], target },
  'intent:action': { id: ID, action: 'align', value: 'left', point: { x: 10, y: 20 } },
  'intent:insert': { target, point: { x: 10, y: 20 } },
  pong: {},
  'key:down': { key: 'z', code: 'KeyZ', mods },
  contextmenu: { id: ID, point: { x: 1, y: 2 } },
  diagnostics: {
    items: [
      {
        code: 'binding.missing',
        message: 'gone',
        severity: 'warning',
        path: ['a', 0],
        details: { path: 'x' },
      },
    ],
  },
  'canvas:error': { message: 'boom', nodeId: ID, fatal: false },
};

const envelope = (type: MessageType, payload: unknown, extra: object = {}) => ({
  source: PROTOCOL_SOURCE,
  protocol: PROTOCOL_VERSION,
  session: SESSION,
  type,
  payload,
  ...extra,
});

describe('the message table of docs/editor.md', () => {
  const editor = readFileSync(new URL('../../../../docs/editor.md', import.meta.url), 'utf8');
  const rows = editor.split('\n').filter((line) => /^\| (E->C|C->E) \|/.test(line));
  const documented = rows.flatMap((line) => {
    const cell = line.split('|')[2] ?? '';
    return [...cell.matchAll(/`([a-z]+(?::[a-z-]+)?)`/g)].map((m) => m[1] as string);
  });

  it('has every documented type as a schema, and no schema the table does not list', () => {
    expect(documented.length).toBeGreaterThan(20);
    const extra = MESSAGE_TYPES.filter((type) => !documented.includes(type));
    const missing = documented.filter(
      (type) => !(MESSAGE_TYPES as readonly string[]).includes(type),
    );
    expect({ extra, missing }).toEqual({ extra: [], missing: [] });
  });

  it('gives every type a direction that matches its row', () => {
    for (const line of rows) {
      const direction = line.startsWith('| E->C') ? 'editor-to-canvas' : 'canvas-to-editor';
      for (const m of (line.split('|')[2] ?? '').matchAll(/`([a-z]+(?::[a-z-]+)?)`/g)) {
        expect(MESSAGE_DIRECTION[m[1] as MessageType], m[1]).toBe(direction);
      }
    }
  });

  it('also covers the handshake pair, which the table lists on one row', () => {
    expect(MESSAGE_TYPES).toContain('canvas:hello');
    expect(MESSAGE_TYPES).toContain('canvas:ready');
  });
});

describe('every message type', () => {
  it.each(MESSAGE_TYPES)('%s: a valid message parses, in the direction of its schema', (type) => {
    const message = envelope(type, valid[type]);
    const result = parseMessage(message);
    expect(result.ok, JSON.stringify(!result.ok && result.error)).toBe(true);
    const fromEditor = parseEditorMessage(message).ok;
    const fromCanvas = parseCanvasMessage(message).ok;
    expect(fromEditor).toBe(MESSAGE_DIRECTION[type] === 'editor-to-canvas');
    expect(fromCanvas).toBe(MESSAGE_DIRECTION[type] === 'canvas-to-editor');
  });

  it.each(MESSAGE_TYPES)('%s: survives being sent (structured clone and JSON)', (type) => {
    const message = envelope(type, valid[type]);
    expect(parseMessage(structuredClone(message)).ok).toBe(true);
    expect(parseMessage(JSON.parse(JSON.stringify(message))).ok).toBe(true);
  });

  it.each(MESSAGE_TYPES)('%s: a payload with an unknown field is refused', (type) => {
    const payload = { ...(valid[type] as object), extra: 1 };
    expect(parseMessage(envelope(type, payload)).ok).toBe(false);
  });

  it.each(MESSAGE_TYPES)('%s: a payload of the wrong kind is refused', (type) => {
    for (const bad of [undefined, null, 'x', 5, [], true]) {
      expect(parseMessage(envelope(type, bad)).ok, String(bad)).toBe(false);
    }
  });

  it.each(MESSAGE_TYPES)('%s: createMessage builds what parseMessage accepts', (type) => {
    const built = createMessage(type, valid[type], { session: SESSION });
    expect(parseMessage(built).ok).toBe(true);
    expect(built.id).toBeUndefined();
    const request = createMessage(type, valid[type], {
      session: SESSION,
      id: 'req_1',
      replyTo: 'req_0',
    });
    expect(request.id).toBe('req_1');
    expect(request.replyTo).toBe('req_0');
    expect(parseMessage(request).ok).toBe(true);
  });
});

describe('the envelope', () => {
  const ready = valid['canvas:ready'];
  const bad = (change: object) =>
    parseMessage({ ...envelope('canvas:ready', ready), ...change }).ok;

  it('is refused unless it is ours, of this version, with a session', () => {
    expect(bad({})).toBe(true);
    expect(bad({ source: 'other' })).toBe(false);
    expect(bad({ source: undefined })).toBe(false);
    expect(PROTOCOL_VERSION).toBe(2);
    expect(bad({ protocol: 1 })).toBe(false);
    expect(bad({ protocol: 3 })).toBe(false);
    expect(bad({ protocol: '1' })).toBe(false);
    expect(bad({ session: undefined })).toBe(false);
    expect(bad({ session: '' })).toBe(false);
    expect(bad({ session: 'short' })).toBe(false);
    expect(bad({ session: 'a'.repeat(129) })).toBe(false);
    expect(bad({ session: 'has spaces in it 1234567' })).toBe(false);
    expect(bad({ session: `${SESSION}"` })).toBe(false);
  });

  it('refuses a field it does not know', () => {
    expect(bad({ extra: true })).toBe(false);
  });

  it('refuses an unknown type, and one with the wrong casing', () => {
    expect(bad({ type: 'canvas:unknown' })).toBe(false);
    expect(bad({ type: 'Canvas:Ready' })).toBe(false);
    expect(bad({ type: undefined })).toBe(false);
    expect(bad({ type: {} })).toBe(false);
  });

  it('takes an id and a reply id of safe characters only', () => {
    expect(bad({ id: 'req-1_a' })).toBe(true);
    expect(bad({ replyTo: 'req-1_a' })).toBe(true);
    for (const id of ['', 'a b', 'a'.repeat(65), 'a/b', 5]) {
      expect(bad({ id }), String(id)).toBe(false);
      expect(bad({ replyTo: id }), String(id)).toBe(false);
    }
  });

  it('refuses what is not an object at all', () => {
    for (const input of [undefined, null, 'buildr', 5, [], () => 1]) {
      expect(parseMessage(input).ok).toBe(false);
    }
  });

  it('can be read on its own, and lets another protocol version through to be told apart', () => {
    expect(parseEnvelope(envelope('canvas:hello', {})).ok).toBe(true);
    expect(parseEnvelope(envelope('canvas:hello', {}, { protocol: 1 })).ok).toBe(true);
    expect(parseEnvelope(envelope('canvas:hello', {}, { protocol: 0 })).ok).toBe(false);
    expect(parseEnvelope(envelope('canvas:hello', {}, { source: 'x' })).ok).toBe(false);
    expect(parseEnvelope(envelope('canvas:hello', {}, { session: 'no' })).ok).toBe(false);
  });

  it('reports why in one short diagnostic, and never throws', () => {
    const result = parseMessage(envelope('selection:set', { ids: ['nope'] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('protocol.invalid-message');
    expect(result.error.severity).toBe('error');
    expect(result.error.message.length).toBeLessThan(301);
    expect(() =>
      parseMessage({
        get type() {
          throw new Error('x');
        },
      }),
    ).not.toThrow();
  });
});

describe('the direction of a message', () => {
  it('lists fourteen from the editor and sixteen from the canvas', () => {
    expect(editorMessageSchema.options).toHaveLength(14);
    expect(canvasMessageSchema.options).toHaveLength(16);
    expect(messageSchema.options).toHaveLength(30);
    expect(MESSAGE_TYPES).toHaveLength(30);
    expect(new Set(MESSAGE_TYPES).size).toBe(30);
  });
});

describe('editor:init', () => {
  const init = (change: object) =>
    parseEditorMessage(envelope('editor:init', { ...valid['editor:init'], ...change })).ok;

  it('takes a document, and refuses one that is not', () => {
    expect(init({})).toBe(true);
    expect(init({ doc: {} })).toBe(false);
    expect(init({ doc: { ...doc, schemaVersion: 2 } })).toBe(false);
    expect(init({ doc: null })).toBe(false);
  });

  it('checks the version, selection, viewport, locale and mode', () => {
    expect(init({ docVersion: -1 })).toBe(false);
    expect(init({ docVersion: 1.5 })).toBe(false);
    expect(init({ selection: ['bad id'] })).toBe(false);
    expect(init({ selection: Array.from({ length: MAX_SELECTION + 1 }, () => ID) })).toBe(false);
    expect(init({ viewport: { breakpoint: 'Tablet', width: 768 } })).toBe(false);
    expect(init({ viewport: { breakpoint: 'tablet', width: 100 } })).toBe(false);
    expect(init({ viewport: { breakpoint: 'tablet', width: 9999 } })).toBe(false);
    expect(init({ locale: 'not a locale' })).toBe(false);
    expect(init({ locale: 'pl-PL' })).toBe(true);
    expect(init({ mode: 'preview' })).toBe(false);
    expect(init({ contextRef: '' })).toBe(false);
    expect(init({ contextRef: null })).toBe(true);
  });

  it('wants a default locale that is one of the locales', () => {
    expect(init({ locales: { ...locales, default: 'de' } })).toBe(false);
    expect(init({ locales: { ...locales, locales: [] } })).toBe(false);
    expect(init({ locales: { ...locales, fallback: 'yes' } })).toBe(false);
  });
});

describe('doc:patch', () => {
  const patch = (payload: object) => parseEditorMessage(envelope('doc:patch', payload)).ok;
  const one = (p: object) => patch({ from: 0, to: 1, patches: [p] });

  it('leads to a later version', () => {
    expect(patch({ from: 1, to: 2, patches: [] })).toBe(true);
    expect(patch({ from: 2, to: 2, patches: [] })).toBe(false);
    expect(patch({ from: 3, to: 2, patches: [] })).toBe(false);
    expect(patch({ from: -1, to: 2, patches: [] })).toBe(false);
  });

  it('takes add, replace and remove, and nothing else', () => {
    expect(one({ op: 'add', path: ['nodes', ID], value: 1 })).toBe(true);
    expect(one({ op: 'replace', path: ['nodes', ID], value: null })).toBe(true);
    expect(one({ op: 'remove', path: ['nodes', ID] })).toBe(true);
    expect(one({ op: 'move', path: ['nodes', ID], from: ['x'] })).toBe(false);
    expect(one({ op: 'test', path: ['nodes'], value: 1 })).toBe(false);
    expect(one({ path: ['nodes'], value: 1 })).toBe(false);
  });

  it('needs a value for add and replace, and none for remove', () => {
    expect(one({ op: 'add', path: ['a'] })).toBe(false);
    expect(one({ op: 'replace', path: ['a'] })).toBe(false);
    expect(one({ op: 'remove', path: ['a'], value: 1 })).toBe(false);
  });

  it('takes JSON values only', () => {
    for (const value of [
      undefined,
      () => 1,
      new Date(),
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Symbol('x'),
      1n,
    ]) {
      expect(one({ op: 'add', path: ['a'], value }), String(value)).toBe(false);
    }
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(one({ op: 'add', path: ['a'], value: cyclic })).toBe(false);
    expect(one({ op: 'add', path: ['a'], value: { a: [1, 'b', null, { c: true }] } })).toBe(true);
  });

  it('never reaches a prototype through a path', () => {
    for (const segment of ['__proto__', 'constructor', 'prototype']) {
      expect(one({ op: 'add', path: ['nodes', segment, 'x'], value: 1 }), segment).toBe(false);
      expect(one({ op: 'remove', path: [segment] }), segment).toBe(false);
    }
    expect(one({ op: 'add', path: ['nodes', 'proto', 'constructors'], value: 1 })).toBe(true);
  });

  it('has a path of names and positions, of a sane length', () => {
    expect(one({ op: 'add', path: [], value: 1 })).toBe(false);
    expect(one({ op: 'add', path: ['a', -1], value: 1 })).toBe(false);
    expect(one({ op: 'add', path: ['a', 1.5], value: 1 })).toBe(false);
    expect(one({ op: 'add', path: ['a', null], value: 1 })).toBe(false);
    expect(one({ op: 'add', path: ['a'.repeat(129)], value: 1 })).toBe(false);
    expect(
      one({ op: 'add', path: Array.from({ length: MAX_PATCH_PATH }, () => 'a'), value: 1 }),
    ).toBe(true);
    expect(
      one({ op: 'add', path: Array.from({ length: MAX_PATCH_PATH + 1 }, () => 'a'), value: 1 }),
    ).toBe(false);
  });

  it('holds a bounded number of patches', () => {
    const p = { op: 'remove', path: ['a'] };
    expect(patch({ from: 0, to: 1, patches: Array.from({ length: MAX_PATCHES }, () => p) })).toBe(
      true,
    );
    expect(
      patch({ from: 0, to: 1, patches: Array.from({ length: MAX_PATCHES + 1 }, () => p) }),
    ).toBe(false);
  });
});

describe('protocol v2 overlay messages', () => {
  const view = (payload: unknown) => parseEditorMessage(envelope('view:set', payload)).ok;
  const action = (payload: unknown) => parseCanvasMessage(envelope('intent:action', payload)).ok;
  const insert = (payload: unknown) => parseCanvasMessage(envelope('intent:insert', payload)).ok;

  it('accepts empty and independent view updates, including clearing hidden nodes', () => {
    for (const payload of [
      {},
      { outlines: false },
      { hidden: [] },
      { theme: 'light' },
      { theme: 'dark' },
      { labels: {} },
      { labels: { remove: 'Usuń blok' } },
    ]) {
      const result = parseEditorMessage(envelope('view:set', payload));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.payload).toEqual(payload);
    }
    for (const payload of [
      { outlines: 1 },
      { hidden: null },
      { hidden: ['bad id'] },
      { theme: 'system' },
      { labels: null },
      { doc: doc },
    ]) {
      expect(view(payload)).toBe(false);
    }
  });

  it('bounds hidden nodes independently of the selection limit', () => {
    expect(view({ hidden: Array.from({ length: MAX_HIDDEN_NODES }, () => ID) })).toBe(true);
    expect(view({ hidden: Array.from({ length: MAX_HIDDEN_NODES + 1 }, () => ID) })).toBe(false);
    expect(view({ hidden: ['root', ID, ID2] })).toBe(true);
  });

  it('accepts every fixed label key, bounded plain text and translations', () => {
    expect(view({ labels: { selectParent: 'Wybierz rodzica', insert: 'Add & edit' } })).toBe(true);
    for (const key of Object.keys(viewLabelsSchema.shape)) {
      expect(view({ labels: { [key]: 'x'.repeat(MAX_VIEW_LABEL_LENGTH) } }), key).toBe(true);
      expect(view({ labels: { [key]: 'x'.repeat(MAX_VIEW_LABEL_LENGTH + 1) } }), key).toBe(false);
    }
  });

  it('refuses arbitrary label keys, markup, controls, empty or non-text labels', () => {
    for (const key of ['unknown', '__proto__', 'constructor', 'prototype']) {
      expect(view({ labels: JSON.parse(`{"${key}":"text"}`) }), key).toBe(false);
    }
    for (const text of [
      '',
      ' ',
      '<b>Remove</b>',
      '<img src=x onerror=alert(1)>',
      'a>b',
      'line\nbreak',
      'tab\there',
      '\u0000',
      '\u007f',
      '\u0085',
      '\u202eRemove',
      '\u2028',
      '\u2029',
      5,
      {},
      null,
    ]) {
      expect(view({ labels: { remove: text } }), JSON.stringify(text)).toBe(false);
    }
  });

  it('bounds type labels: type id keys, plain text values, at most 128 entries', () => {
    expect(view({ typeLabels: {} })).toBe(true);
    expect(view({ typeLabels: { 'buildr/heading': 'Nagłówek' }, scale: 0.62 })).toBe(true);
    const many = (n: number) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`app/type-${i}`, 'Typ']));
    expect(view({ typeLabels: many(MAX_TYPE_LABELS) })).toBe(true);
    expect(view({ typeLabels: many(MAX_TYPE_LABELS + 1) })).toBe(false);
    for (const key of ['Heading', 'heading', 'a/b/c', 'buildr/Heading', `x/${'a'.repeat(70)}`]) {
      expect(view({ typeLabels: JSON.parse(`{"${key}":"Typ"}`) }), key).toBe(false);
    }
    for (const text of ['', '<b>x</b>', 'line\nbreak', '‮x', 'x'.repeat(41), 5, null]) {
      expect(view({ typeLabels: { 'buildr/heading': text } }), JSON.stringify(text)).toBe(false);
    }
    const proto = parseEditorMessage(
      envelope('view:set', { typeLabels: JSON.parse('{"__proto__":"Typ"}') }),
    );
    if (proto.ok) {
      const labels = (proto.value.payload as { typeLabels?: object }).typeLabels ?? {};
      expect(Object.hasOwn(labels, '__proto__')).toBe(false);
    }
    expect(view({ typeLabels: null })).toBe(false);
    for (const scale of [0, 0.05, 5, Number.NaN, '1'])
      expect(view({ scale }), String(scale)).toBe(false);
  });

  it('allows only the enumerated actions and gives only align a required value', () => {
    for (const name of ['selectParent', 'moveUp', 'moveDown', 'duplicate', 'remove', 'more']) {
      expect(action({ id: ID, action: name })).toBe(true);
      expect(action({ id: ID, action: name, value: 'left' })).toBe(false);
    }
    for (const value of ['left', 'center', 'right']) {
      expect(action({ id: 'root', action: 'align', value })).toBe(true);
    }
    for (const payload of [
      { id: ID, action: 'align' },
      { id: ID, action: 'align', value: 'justify' },
      { id: ID, action: 'unknown' },
      { id: ID, action: 'node.setProp' },
      { id: ID, action: 'remove', command: {} },
      { id: 'bad id', action: 'remove' },
      { id: null, action: 'remove' },
      { action: 'remove' },
      { id: ID },
    ]) {
      expect(action(payload)).toBe(false);
    }
  });

  it('requires the existing drop-target shape and bounds every target field', () => {
    expect(insert({ target })).toBe(true);
    expect(insert({ target: { parentId: ID, slot: 's'.repeat(64), index: 1_000_000 } })).toBe(true);
    for (const badTarget of [
      undefined,
      null,
      {},
      { ...target, parentId: 'bad id' },
      { ...target, slot: '' },
      { ...target, slot: 'Bad slot' },
      { ...target, slot: 's'.repeat(65) },
      { ...target, index: -1 },
      { ...target, index: 0.5 },
      { ...target, index: 1_000_001 },
      { ...target, index: Number.POSITIVE_INFINITY },
      { ...target, extra: true },
    ]) {
      expect(insert({ target: badTarget }), JSON.stringify(badTarget)).toBe(false);
    }
    expect(insert({ target, doc })).toBe(false);
  });

  it('accepts optional trigger client coordinates, finite and bounded, with no extra keys', () => {
    for (const base of [
      { type: 'intent:action', payload: { id: ID, action: 'more' } },
      { type: 'intent:action', payload: { id: ID, action: 'align', value: 'center' } },
      { type: 'intent:insert', payload: { target } },
    ] as const) {
      const at = (point: unknown) =>
        parseCanvasMessage(envelope(base.type, { ...base.payload, point })).ok;
      expect(at({ x: -1_000_000, y: 1_000_000 })).toBe(true);
      expect(at({ x: 10.5, y: -0.5 })).toBe(true);
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1_000_001, 1_000_001, '1']) {
        expect(at({ x: bad, y: 0 })).toBe(false);
        expect(at({ x: 0, y: bad })).toBe(false);
      }
      for (const point of [null, {}, { x: 1 }, { x: 0, y: 0, extra: 1 }]) {
        expect(at(point)).toBe(false);
      }
    }
  });

  it('keeps key:down limited to its existing key, code and mods', () => {
    expect(parseCanvasMessage(envelope('key:down', valid['key:down'])).ok).toBe(true);
    expect(
      parseCanvasMessage(envelope('key:down', { ...valid['key:down'], repeat: true })).ok,
    ).toBe(false);
  });
});

describe('the small messages', () => {
  const editor = (type: MessageType, payload: unknown) =>
    parseEditorMessage(envelope(type, payload)).ok;
  const canvas = (type: MessageType, payload: unknown) =>
    parseCanvasMessage(envelope(type, payload)).ok;

  it('name nodes by a real id, or the root', () => {
    expect(editor('scroll:to', { id: 'root' })).toBe(true);
    for (const id of ['', 'short', 'toolongidentifier', 'has space!', 5, null, undefined]) {
      expect(editor('scroll:to', { id }), String(id)).toBe(false);
    }
    expect(editor('hover:set', { id: null })).toBe(true);
    expect(editor('hover:set', { id: undefined })).toBe(false);
    expect(editor('selection:set', { ids: [] })).toBe(true);
    expect(editor('selection:set', { ids: 'x' })).toBe(false);
  });

  it('set the viewport, locale, context and mode', () => {
    expect(editor('viewport:set', { breakpoint: 'mobile', width: 375 })).toBe(true);
    expect(editor('viewport:set', { breakpoint: 'mobile' })).toBe(false);
    expect(editor('locale:set', { locale: 'en' })).toBe(true);
    expect(editor('locale:set', { locale: '<script>' })).toBe(false);
    expect(editor('context:set', { contextRef: 'x' })).toBe(true);
    expect(editor('context:set', {})).toBe(false);
    expect(editor('mode:set', { mode: 'edit' })).toBe(true);
    expect(editor('mode:set', 'edit')).toBe(false);
    expect(editor('mode:set', { mode: 'other' })).toBe(false);
  });

  it('forward a drag: what is dragged, and where the pointer is', () => {
    const over = (point: unknown, item: unknown) => editor('dnd:over', { point, item });
    const at = { x: 1, y: 2 };
    expect(over(at, { kind: 'template', id: 'buildr/hero', variant: 'centered' })).toBe(true);
    expect(over(at, { kind: 'template', id: 'buildr/hero' })).toBe(true);
    expect(over(at, { kind: 'nodes', ids: [ID] })).toBe(true);
    expect(over(at, { kind: 'nodes', ids: [] })).toBe(false);
    expect(over(at, { kind: 'component', type: 'Text' })).toBe(false);
    expect(over(at, { kind: 'other' })).toBe(false);
    expect(over({ x: Number.NaN, y: 0 }, { kind: 'nodes', ids: [ID] })).toBe(false);
    expect(over({ x: 1e9, y: 0 }, { kind: 'nodes', ids: [ID] })).toBe(false);
    expect(over({ x: 1 }, { kind: 'nodes', ids: [ID] })).toBe(false);
  });

  it('report pointer events with their modifiers, and a hover that leaves', () => {
    for (const type of ['node:click', 'node:dblclick'] as const) {
      expect(canvas(type, { id: ID, modifiers: mods })).toBe(true);
      expect(canvas(type, { id: null, modifiers: mods })).toBe(false);
      expect(canvas(type, { id: ID })).toBe(false);
      expect(canvas(type, { id: ID, modifiers: { ...mods, extra: true } })).toBe(false);
      expect(canvas(type, { id: ID, modifiers: { shift: 1, alt: 0, ctrl: 0, meta: 0 } })).toBe(
        false,
      );
      expect(canvas(type, { id: ID, instance: '', modifiers: mods })).toBe(false);
      expect(canvas(type, { id: ID, instance: 'x'.repeat(201), modifiers: mods })).toBe(false);
    }
    expect(canvas('node:hover', { id: null, modifiers: mods })).toBe(true);
  });

  it('commit an inline edit to a named prop, as text', () => {
    expect(canvas('inline:commit', { id: ID, prop: 'text', value: '' })).toBe(true);
    expect(canvas('inline:commit', { id: ID, prop: 'text', value: 'x'.repeat(20_001) })).toBe(
      false,
    );
    expect(canvas('inline:commit', { id: ID, prop: 'a.b', value: 'x' })).toBe(false);
    for (const prop of ['__proto__', 'constructor', 'prototype']) {
      expect(canvas('inline:commit', { id: ID, prop, value: 'x' }), prop).toBe(false);
    }
    expect(canvas('inline:commit', { id: ID, prop: 'text', value: 5 })).toBe(false);
    expect(canvas('inline:commit', { id: ID, prop: '', value: 'x' })).toBe(false);
  });

  it('answer a drag with a target, or a reason for none', () => {
    expect(canvas('dnd:target', { target })).toBe(true);
    expect(canvas('dnd:target', { target: null })).toBe(true);
    expect(canvas('dnd:target', {})).toBe(false);
    expect(canvas('dnd:target', { target: { ...target, index: -1 } })).toBe(false);
    expect(canvas('dnd:target', { target: { ...target, slot: 'Bad Slot' } })).toBe(false);
    expect(canvas('dnd:target', { target, reason: { code: '', message: 'x' } })).toBe(false);
    expect(
      canvas('dnd:target', {
        target: null,
        reason: { code: 'x', message: 'y', params: { a: () => 1 } },
      }),
    ).toBe(false);
  });

  it('ask to move nodes to a target', () => {
    expect(canvas('intent:move', { ids: [], target })).toBe(false);
    expect(canvas('intent:move', { ids: [ID], target: null })).toBe(false);
    expect(canvas('intent:move', { ids: [ID] })).toBe(false);
  });

  it('forward keys and the context menu', () => {
    expect(canvas('key:down', { key: '', code: 'KeyZ', mods })).toBe(false);
    expect(canvas('key:down', { key: 'x'.repeat(33), code: 'KeyZ', mods })).toBe(false);
    expect(canvas('key:down', { key: 'z', code: 'KeyZ' })).toBe(false);
    expect(canvas('contextmenu', { id: null, point: { x: 0, y: 0 } })).toBe(true);
    expect(canvas('contextmenu', { id: ID })).toBe(false);
  });

  it('say what the canvas found: diagnostics, and errors that may be fatal', () => {
    expect(canvas('diagnostics', { items: [] })).toBe(true);
    expect(canvas('diagnostics', { items: [{ code: 'x', message: 'y', severity: 'info' }] })).toBe(
      false,
    );
    expect(
      canvas('diagnostics', { items: [{ code: 'x', message: 'y', severity: 'error', extra: 1 }] }),
    ).toBe(false);
    expect(
      canvas('diagnostics', {
        items: Array.from({ length: 501 }, () => ({ code: 'x', message: 'y', severity: 'error' })),
      }),
    ).toBe(false);
    expect(canvas('canvas:error', { message: 'x', fatal: true })).toBe(true);
    expect(canvas('canvas:error', { message: 'x' })).toBe(false);
    expect(canvas('canvas:error', { message: 'x'.repeat(2001), fatal: false })).toBe(false);
    expect(canvas('canvas:hello', { protocol: 0, rendererVersion: '1', manifestHash: 'a' })).toBe(
      false,
    );
    expect(
      canvas('canvas:hello', {
        protocol: PROTOCOL_VERSION,
        rendererVersion: '',
        manifestHash: 'a',
      }),
    ).toBe(false);
    expect(canvas('doc:resync-request', { have: -1 })).toBe(false);
  });
});
