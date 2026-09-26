// @vitest-environment jsdom
import { type PropDef, p, type RichTextRootNode, richTextSchema } from '@next-buildr/core';
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MessagesProvider } from '../../../messages/index.tsx';
import { moveItem, renderControl } from './compound.tsx';
import { serializeRichText, toRichText } from './rich-text-model.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

/** A control holding its own value, the way the store does; `seen` records every value it wrote. */
async function mount(def: PropDef, initial: unknown, seen: unknown[] = []) {
  function Host() {
    const [value, setValue] = useState(initial);
    return renderControl(def, {
      id: 'c',
      def,
      label: 'Field',
      describedBy: undefined,
      value,
      disabled: false,
      onChange: (next) => {
        seen.push(next);
        setValue(next);
      },
    });
  }
  await act(async () =>
    root.render(
      <MessagesProvider locale="en">
        <Host />
      </MessagesProvider>,
    ),
  );
  return seen;
}

const byLabel = (label: string) =>
  container.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement;
const click = (element: Element) =>
  act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

/** Every node of the format carries `version: 1`; the samples leave it out and this adds it. */
const withVersions = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(withVersions);
  if (typeof node !== 'object' || node === null) return node;
  const entries = Object.entries(node).map(([key, value]) => [key, withVersions(value)] as const);
  return { ...Object.fromEntries(entries), ...('type' in node ? { version: 1 } : {}) };
};
const doc = (children: unknown[]): RichTextRootNode =>
  withVersions({ type: 'root', children }) as RichTextRootNode;
const text = (value: string, format = 0) => ({ type: 'text', text: value, format });

describe('rich text model', () => {
  const samples: RichTextRootNode[] = [
    doc([]),
    doc([{ type: 'paragraph', children: [text('Hello '), text('world', 1)] }]),
    doc([
      { type: 'heading', tag: 'h2', children: [text('Title')] },
      {
        type: 'paragraph',
        children: [
          { type: 'link', url: 'https://example.com', children: [text('a link', 2)] },
          { type: 'linebreak' },
          text('after'),
        ],
      },
      {
        type: 'list',
        listType: 'number',
        children: [
          { type: 'listitem', children: [text('one')] },
          { type: 'listitem', children: [text('two')] },
        ],
      },
    ]),
  ];

  it.each(samples.map((sample, index) => [index, sample] as const))(
    'sample %i survives load and serialize',
    async (_, sample) => {
      await mount(p.richText({}), sample);
      const editor = (
        container.querySelector('[role=textbox]') as HTMLElement & {
          __lexicalEditor: LexicalEditor;
        }
      ).__lexicalEditor;
      const out = serializeRichText(editor.getEditorState());
      expect(out).toEqual(sample);
    },
  );

  it('turns anything that is not rich text into an empty document', () => {
    expect(toRichText(null).children).toEqual([]);
    expect(toRichText('plain').children).toEqual([]);
    expect(richTextSchema.safeParse(toRichText({ junk: true })).success).toBe(true);
  });

  it('only writes documents that pass the schema', async () => {
    const seen = await mount(p.richText({}), doc([]));
    const editor = (
      container.querySelector('[role=textbox]') as HTMLElement & {
        __lexicalEditor: LexicalEditor;
      }
    ).__lexicalEditor;
    await act(async () => {
      editor.update(
        () => {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('typed'));
          $getRoot().clear().append(paragraph);
        },
        { discrete: true },
      );
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const value of seen) expect(richTextSchema.safeParse(value).success).toBe(true);
    expect(seen.at(-1)).toEqual(doc([{ type: 'paragraph', children: [text('typed')] }]));
  });

  it('shows a value that changed elsewhere', async () => {
    await mount(p.richText({}), doc([{ type: 'paragraph', children: [text('first')] }]));
    expect(container.querySelector('[role=textbox]')?.textContent).toBe('first');
  });

  it('labels the toolbar buttons and reflects their state', async () => {
    await mount(p.richText({}), doc([]));
    expect(container.querySelector('[role=toolbar]')).not.toBeNull();
    for (const name of ['Bold', 'Italic', 'Link', 'Heading 2', 'Bulleted list']) {
      expect(byLabel(name).getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('refuses an unsafe link address', async () => {
    await mount(p.richText({}), doc([{ type: 'paragraph', children: [text('x')] }]));
    await click(byLabel('Link'));
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        input,
        'javascript:alert(1)',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[role=alert]')?.textContent).toBe(
      'This address is not allowed.',
    );
  });
});

describe('list control', () => {
  const def = p.list(p.text({ default: 'new' }), { min: 1, max: 3 });

  it('adds an item made from the item default, up to the maximum', async () => {
    const seen = await mount(def, ['a', 'b']);
    await click(
      [...container.querySelectorAll('button')].find(
        (b) => b.textContent === 'Add item',
      ) as Element,
    );
    expect(seen.at(-1)).toEqual(['a', 'b', 'new']);
    expect(
      (
        [...container.querySelectorAll('button')].find(
          (b) => b.textContent === 'Add item',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('removes an item, down to the minimum', async () => {
    const seen = await mount(def, ['a', 'b']);
    await click(byLabel('Remove: Item 1'));
    expect(seen.at(-1)).toEqual(['b']);
    expect(byLabel('Remove: Item 1').disabled).toBe(true);
  });

  it('moves items and stops at the ends', async () => {
    const seen = await mount(def, ['a', 'b', 'c']);
    expect(byLabel('Move up: Item 1').disabled).toBe(true);
    expect(byLabel('Move down: Item 3').disabled).toBe(true);
    await click(byLabel('Move down: Item 1'));
    expect(seen.at(-1)).toEqual(['b', 'a', 'c']);
    await click(byLabel('Move up: Item 3'));
    expect(seen.at(-1)).toEqual(['b', 'c', 'a']);
  });

  it('edits an item with the control of its kind', async () => {
    const seen = await mount(def, ['a', 'b']);
    const input = container.querySelector('#c-1') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        input,
        'changed',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(seen.at(-1)).toEqual(['a', 'changed']);
  });

  it('treats a value that is not a list as empty', async () => {
    await mount(p.list(p.text({})), 'nonsense');
    expect(container.textContent).toContain('No items yet.');
  });

  it('moveItem ignores positions out of range', () => {
    expect(moveItem([1, 2], 0, 5)).toEqual([1, 2]);
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
  });
});

describe('object control', () => {
  const def = p.object({ label: p.text({ default: 'L' }), count: p.number({ default: 2 }) });

  it('shows defaults for missing fields and writes the whole object', async () => {
    const seen = await mount(def, { label: 'Own' });
    expect((container.querySelector('#c-label') as HTMLInputElement).value).toBe('Own');
    expect((container.querySelector('#c-count') as HTMLInputElement).value).toBe('2');
    const input = container.querySelector('#c-label') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'X');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(seen.at(-1)).toEqual({ label: 'X' });
  });

  it('nests lists inside objects', async () => {
    const nested = p.object({ tags: p.list(p.text({ default: 't' })) });
    const seen = await mount(nested, { tags: [] });
    await click(
      [...container.querySelectorAll('button')].find(
        (b) => b.textContent === 'Add item',
      ) as Element,
    );
    expect(seen.at(-1)).toEqual({ tags: ['t'] });
  });
});
