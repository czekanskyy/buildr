// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installInteractions, instanceOf } from './interactions.ts';
import { computeBoxes, createOverlay, openAncestorDetails } from './overlay/overlay.ts';
import { createCanvasStore } from './store.ts';
import type { CanvasTransport } from './types.ts';

const sent: { type: string; payload: unknown }[] = [];
const transport = {
  send: (type: string, payload: unknown) => {
    sent.push({ type, payload });
    return true;
  },
} as unknown as CanvasTransport;

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect;

let stop: () => void;
const store = createCanvasStore();

beforeEach(() => {
  sent.length = 0;
  document.body.innerHTML = `
    <div data-bid="a"><a id="link" href="https://example.com/" data-bid="b">go</a></div>
    <form id="form"><button id="send" type="submit">send</button></form>
    <ul><li data-bid="item" data-bi="0">x</li><li data-bid="item" data-bi="1"><span data-bid="deep" data-bi="4">y</span></li></ul>
    <details id="d"><summary>s</summary><p data-bid="hidden">h</p></details>`;
  store.update({ mode: 'edit', selection: [], hover: null });
  stop = installInteractions({ document, store, transport: () => transport });
});

afterEach(() => {
  stop();
  vi.restoreAllMocks();
});

const $ = (selector: string) => document.querySelector(selector) as HTMLElement;

describe('installInteractions', () => {
  it('turns a click into a selection and stops the link from navigating', () => {
    const seen = vi.fn();
    document.body.addEventListener('click', seen);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true });
    $('#link').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(seen).not.toHaveBeenCalled();
    expect(sent).toEqual([
      {
        type: 'node:click',
        payload: {
          id: 'b',
          modifiers: { shift: true, alt: false, ctrl: false, meta: false },
        },
      },
    ]);
  });

  it('names the Loop repetition a node is in', () => {
    $('li[data-bi="1"] span').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sent[0]?.payload).toMatchObject({ id: 'deep', instance: '1.4' });
    expect(instanceOf($('#link'))).toBeUndefined();
  });

  it('blocks a click on no node without reporting it', () => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    $('#send').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(sent).toEqual([]);
  });

  it('reports a double click', () => {
    $('#link').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    expect(sent[0]).toMatchObject({ type: 'node:dblclick', payload: { id: 'b' } });
  });

  it('blocks a form from submitting', () => {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    $('#form').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('reports hover once per node, and none when the pointer leaves the page', () => {
    const over = (el: HTMLElement) =>
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    over($('#link'));
    over($('#link'));
    over($('#form'));
    $('#form').dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }));
    expect(sent.map((m) => (m.payload as { id: string | null }).id)).toEqual(['b', null]);
  });

  it('captures nothing in interact mode', () => {
    store.update({ mode: 'interact' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    $('#link').dispatchEvent(click);
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    $('#form').dispatchEvent(submit);
    expect(click.defaultPrevented).toBe(false);
    expect(submit.defaultPrevented).toBe(false);
    expect(sent).toEqual([]);
  });

  it('stops listening once removed', () => {
    stop();
    $('#link').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sent).toEqual([]);
  });
});

describe('overlay', () => {
  const layout = () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const id = this.getAttribute('data-bid');
      if (id === 'a') return rect(10, 100, 200, 50);
      if (id === 'item') return rect(0, this.getAttribute('data-bi') === '0' ? 200 : 260, 100, 40);
      if (id === 'b') return rect(20, 5, 30, 10);
      return rect(0, 0, 0, 0);
    });
  };

  it('outlines the selection with a label, and every Loop repetition (dashed after the first)', () => {
    layout();
    store.update({ selection: ['a', 'item'] });
    expect(computeBoxes(document, store)).toEqual([
      { kind: 'selected', primary: true, left: 10, top: 100, width: 200, height: 50 },
      { kind: 'selected', primary: true, left: 0, top: 200, width: 100, height: 40 },
      { kind: 'selected', primary: false, left: 0, top: 260, width: 100, height: 40 },
    ]);
  });

  it('draws into a shadow root that does not disturb the page', () => {
    layout();
    store.setDocument(
      {
        schemaVersion: 1,
        root: 'a',
        nodes: { a: { id: 'a', type: 'buildr/section' } },
        components: {},
      } as never,
      1,
    );
    store.update({ selection: ['a'], hover: 'b' });
    const before = document.body.children.length;
    const overlay = createOverlay({ document, store });
    overlay.refresh();
    expect(document.body.children.length).toBe(before + 1);
    const layer = overlay.host.shadowRoot?.querySelector('.layer');
    expect(layer?.querySelectorAll('.box')).toHaveLength(2);
    expect(layer?.querySelector('.box.hover')).not.toBeNull();
    const box = layer?.querySelector('.box.selected') as HTMLElement;
    expect(box.style.left).toBe('10px');
    expect(box.style.top).toBe('100px');
    expect(box.querySelector('.label')?.textContent).toBe('buildr/section');
    expect(document.querySelector('[data-buildr-overlay] .box')).toBeNull();

    store.update({ selection: [], hover: null });
    overlay.refresh();
    expect(layer?.querySelectorAll('.box')).toHaveLength(0);
    overlay.destroy();
    expect(document.querySelector('[data-buildr-overlay]')).toBeNull();
  });

  it('opens the collapsed details a selected node is in', () => {
    expect(openAncestorDetails($('[data-bid="hidden"]'))).toBe(true);
    expect((document.getElementById('d') as HTMLDetailsElement).open).toBe(true);
    expect(openAncestorDetails($('[data-bid="hidden"]'))).toBe(false);
  });

  it('warns once about a selected node with no data-bid element', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.update({ selection: ['nowhere'] });
    const overlay = createOverlay({ document, store, warn: true });
    overlay.refresh();
    overlay.refresh();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('nowhere');
    overlay.destroy();
  });

  it('redraws on the next frame after the selection changes', async () => {
    layout();
    const overlay = createOverlay({ document, store });
    store.update({ selection: ['a'] });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(overlay.host.shadowRoot?.querySelectorAll('.box')).toHaveLength(1);
    overlay.destroy();
  });
});
