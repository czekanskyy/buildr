// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installForwarding, isEditorShortcut } from './forwarding.ts';
import { createCanvasStore } from './store.ts';
import type { CanvasTransport } from './types.ts';

const sent: { type: string; payload: unknown }[] = [];
const transport = {
  send: (type: string, payload: unknown) => {
    sent.push({ type, payload });
    return true;
  },
} as unknown as CanvasTransport;

const payload = (index: number) => (sent[index]?.payload ?? {}) as Record<string, unknown>;
const store = createCanvasStore();
let stop: () => void;

beforeEach(() => {
  sent.length = 0;
  document.body.innerHTML = `<div data-bid="a"><p id="p" data-bid="b">text</p><input id="in"><textarea id="ta"></textarea><div id="ed" contenteditable="plaintext-only" data-bid="c">e</div></div>`;
  store.update({ mode: 'edit' });
  stop = installForwarding({ document, store, transport: () => transport });
});
afterEach(() => stop());

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const press = (target: HTMLElement, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('isEditorShortcut', () => {
  const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) =>
    isEditorShortcut({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods });

  it('accepts the editor shortcuts', () => {
    expect(key('z', { ctrlKey: true })).toBe(true);
    expect(key('Z', { metaKey: true })).toBe(true);
    expect(key('y', { ctrlKey: true })).toBe(true);
    expect(key('Delete')).toBe(true);
    expect(key('Escape')).toBe(true);
    expect(key('ArrowUp', { altKey: true })).toBe(true);
  });

  it('leaves the browser its own shortcuts and ordinary typing', () => {
    for (const k of ['r', 'w', 't', 'l', 'f', 'p']) expect(key(k, { ctrlKey: true })).toBe(false);
    expect(key('F5')).toBe(false);
    expect(key('F12')).toBe(false);
    expect(key('a')).toBe(false);
    expect(key('ArrowUp')).toBe(false);
    expect(key('z', { ctrlKey: true, altKey: true })).toBe(false);
  });
});

describe('installForwarding', () => {
  it('sends Ctrl+Z to the editor and keeps the browser from acting on it', () => {
    const event = press($('p'), { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(sent).toEqual([
      {
        type: 'key:down',
        payload: {
          key: 'z',
          code: 'KeyZ',
          mods: { shift: false, alt: false, ctrl: true, meta: false },
        },
      },
    ]);
  });

  it('sends shift as a modifier, once for a held key', () => {
    press($('p'), { key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true });
    const held = press($('p'), { key: 'z', code: 'KeyZ', ctrlKey: true, repeat: true });
    expect(held.defaultPrevented).toBe(true);
    expect(sent).toHaveLength(1);
    expect((payload(0)['mods'] as { shift: boolean }).shift).toBe(true);
  });

  it('ignores keys the editor has no use for', () => {
    const event = press($('p'), { key: 'r', code: 'KeyR', ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(sent).toEqual([]);
  });

  it('leaves text fields and text being edited alone', () => {
    for (const id of ['in', 'ta', 'ed']) {
      const event = press($(id), { key: 'z', code: 'KeyZ', ctrlKey: true });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(sent).toEqual([]);
  });

  it('leaves everything alone during an inline edit session, and in interact mode', () => {
    store.setDocument(
      {
        schemaVersion: 1,
        root: 'b',
        nodes: { b: { id: 'b', type: 'x' } },
        components: {},
      } as never,
      1,
    );
    store.beginEdit('b');
    press($('p'), { key: 'Delete', code: 'Delete' });
    store.endEdit();
    store.update({ mode: 'interact' });
    press($('p'), { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(sent).toEqual([]);
  });

  it('falls back to the key when an event has no code', () => {
    press($('p'), { key: 'Escape' });
    expect(payload(0)['code']).toBe('Escape');
  });

  it('sends the context menu with the node and the point, and stops the browser menu', () => {
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 30,
      clientY: 40,
    });
    $('p').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(sent).toEqual([{ type: 'contextmenu', payload: { id: 'b', point: { x: 30, y: 40 } } }]);
  });

  it('sends none for a right click outside every node, keeps the native menu in text', () => {
    const outside = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(outside);
    expect(sent).toEqual([{ type: 'contextmenu', payload: { id: null, point: { x: 0, y: 0 } } }]);
    sent.length = 0;
    const inText = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    $('in').dispatchEvent(inText);
    expect(inText.defaultPrevented).toBe(false);
    expect(sent).toEqual([]);
  });

  it('stops listening once removed', () => {
    stop();
    press($('p'), { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(sent).toEqual([]);
  });
});
