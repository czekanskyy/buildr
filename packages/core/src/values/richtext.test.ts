import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { JsonValue } from '../json/json-value.ts';
import {
  MAX_RICH_TEXT_DEPTH,
  MAX_RICH_TEXT_STRING_LENGTH,
  normalizeRichText,
  plainTextToRichText,
  type RichTextRootNode,
  richTextSchema,
} from './richtext.ts';

const paragraph = (text: string) => ({
  type: 'paragraph',
  version: 1,
  children: [{ type: 'text', version: 1, text, format: 0 }],
});

const root = (children: readonly unknown[]) => ({ type: 'root', version: 1, children });

describe('richTextSchema', () => {
  it('accepts a well-formed tree covering every node type', () => {
    const value: RichTextRootNode = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'heading',
          version: 1,
          tag: 'h1',
          children: [{ type: 'text', version: 1, text: 'Title', format: 1 }],
        },
        {
          type: 'paragraph',
          version: 1,
          children: [
            { type: 'text', version: 1, text: 'Hello ', format: 0 },
            { type: 'linebreak', version: 1 },
            {
              type: 'link',
              version: 1,
              url: 'https://example.com',
              children: [{ type: 'text', version: 1, text: 'world', format: 0 }],
            },
          ],
        },
        {
          type: 'quote',
          version: 1,
          children: [{ type: 'text', version: 1, text: 'A quote', format: 0 }],
        },
        {
          type: 'list',
          version: 1,
          listType: 'bullet',
          children: [
            {
              type: 'listitem',
              version: 1,
              children: [
                { type: 'text', version: 1, text: 'item 1', format: 0 },
                {
                  type: 'list',
                  version: 1,
                  listType: 'number',
                  children: [
                    {
                      type: 'listitem',
                      version: 1,
                      children: [{ type: 'text', version: 1, text: 'nested', format: 0 }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(richTextSchema.safeParse(value).success).toBe(true);
  });

  it('rejects an unknown node type', () => {
    expect(
      richTextSchema.safeParse(root([{ type: 'code', version: 1, children: [] }])).success,
    ).toBe(false);
  });

  it('rejects extra, unrecognized fields on a node (strict)', () => {
    const value = root([{ ...paragraph('hi'), extra: true }]);
    expect(richTextSchema.safeParse(value).success).toBe(false);
  });

  it('rejects a non-root top level', () => {
    expect(richTextSchema.safeParse(paragraph('hi')).success).toBe(false);
  });

  it('round-trips every value normalizeRichText can produce', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (input) => {
        const { value } = normalizeRichText(input as JsonValue);
        expect(richTextSchema.safeParse(value).success).toBe(true);
      }),
    );
  });
});

describe('normalizeRichText', () => {
  it('passes through a well-formed tree unchanged', () => {
    const value = root([paragraph('Hello world')]);
    const result = normalizeRichText(value as JsonValue);
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toEqual(value);
  });

  it('returns an empty root with a diagnostic for a non-root value', () => {
    const result = normalizeRichText('not a rich text document' as unknown as JsonValue);
    expect(result.value).toEqual({ type: 'root', version: 1, children: [] });
    expect(result.diagnostics).toMatchObject([{ code: 'richtext.invalid-root' }]);
  });

  it('returns an empty root with a diagnostic for null', () => {
    const result = normalizeRichText(null);
    expect(result.value).toEqual({ type: 'root', version: 1, children: [] });
    expect(result.diagnostics).toMatchObject([{ code: 'richtext.invalid-root' }]);
  });

  it('drops an unknown top-level node type with a diagnostic', () => {
    const result = normalizeRichText(
      root([{ type: 'table', version: 1, children: [] }]) as JsonValue,
    );
    expect(result.value.children).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      { code: 'richtext.unknown-node', details: { type: 'table' } },
    ]);
  });

  it('drops an unknown inline node type inside a paragraph, keeping its siblings', () => {
    const value = root([
      {
        type: 'paragraph',
        version: 1,
        children: [
          { type: 'text', version: 1, text: 'before', format: 0 },
          { type: 'upload', version: 1 },
          { type: 'text', version: 1, text: 'after', format: 0 },
        ],
      },
    ]);
    const result = normalizeRichText(value as JsonValue);
    expect(result.value.children).toEqual([
      {
        type: 'paragraph',
        version: 1,
        children: [
          { type: 'text', version: 1, text: 'before', format: 0 },
          { type: 'text', version: 1, text: 'after', format: 0 },
        ],
      },
    ]);
    expect(result.diagnostics).toMatchObject([
      { code: 'richtext.unknown-node', details: { type: 'upload' } },
    ]);
  });

  it('never passes an unknown node through raw', () => {
    const value = root([
      { type: 'script', version: 1, dangerouslySetInnerHTML: '<script>alert(1)</script>' },
    ]);
    const result = normalizeRichText(value as JsonValue);
    expect(JSON.stringify(result.value)).not.toContain('script');
  });

  it('sanitizes an unsafe link url, falling back to an empty string, and keeps the link', () => {
    const value = root([
      {
        type: 'paragraph',
        version: 1,
        children: [
          {
            type: 'link',
            version: 1,
            url: 'javascript:alert(1)',
            children: [{ type: 'text', version: 1, text: 'click', format: 0 }],
          },
        ],
      },
    ]);
    const result = normalizeRichText(value as JsonValue);
    expect(result.value.children).toEqual([
      {
        type: 'paragraph',
        version: 1,
        children: [
          {
            type: 'link',
            version: 1,
            url: '',
            children: [{ type: 'text', version: 1, text: 'click', format: 0 }],
          },
        ],
      },
    ]);
    expect(result.diagnostics).toMatchObject([{ code: 'url.unsafe-scheme' }]);
  });

  it('keeps a safe link url unchanged', () => {
    const value = root([
      {
        type: 'paragraph',
        version: 1,
        children: [
          {
            type: 'link',
            version: 1,
            url: 'https://example.com',
            children: [{ type: 'text', version: 1, text: 'click', format: 0 }],
          },
        ],
      },
    ]);
    const result = normalizeRichText(value as JsonValue);
    expect(result.diagnostics).toEqual([]);
    expect(
      (result.value.children[0] as { children: readonly { url: string }[] }).children[0]?.url,
    ).toBe('https://example.com');
  });

  it('caps an oversized text node', () => {
    const huge = 'x'.repeat(MAX_RICH_TEXT_STRING_LENGTH + 1000);
    const result = normalizeRichText(root([paragraph(huge)]) as JsonValue);
    const text = (result.value.children[0] as { children: readonly { text: string }[] }).children[0]
      ?.text;
    expect(text).toHaveLength(MAX_RICH_TEXT_STRING_LENGTH);
  });

  it('coerces a missing/invalid version to 1', () => {
    const value = root([{ type: 'paragraph', children: [] }]);
    const result = normalizeRichText(value as JsonValue);
    expect(result.value.children[0]?.version).toBe(1);
  });

  it('falls back to a default heading tag / list type when invalid', () => {
    const value = root([
      { type: 'heading', version: 1, tag: 'h9', children: [] },
      { type: 'list', version: 1, listType: 'roman', children: [] },
    ]);
    const result = normalizeRichText(value as JsonValue);
    expect(result.value.children).toEqual([
      { type: 'heading', version: 1, tag: 'h1', children: [] },
      { type: 'list', version: 1, listType: 'bullet', children: [] },
    ]);
  });

  it('drops a non-listitem child of a list with a diagnostic', () => {
    const value = root([
      {
        type: 'list',
        version: 1,
        listType: 'bullet',
        children: [{ type: 'paragraph', version: 1, children: [] }],
      },
    ]);
    const result = normalizeRichText(value as JsonValue);
    expect((result.value.children[0] as { children: readonly unknown[] }).children).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      { code: 'richtext.unknown-node', details: { type: 'paragraph' } },
    ]);
  });

  it('keeps a nested list inside a list item', () => {
    const value = root([
      {
        type: 'list',
        version: 1,
        listType: 'bullet',
        children: [
          {
            type: 'listitem',
            version: 1,
            children: [
              { type: 'text', version: 1, text: 'outer', format: 0 },
              {
                type: 'list',
                version: 1,
                listType: 'number',
                children: [
                  {
                    type: 'listitem',
                    version: 1,
                    children: [{ type: 'text', version: 1, text: 'inner', format: 0 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const result = normalizeRichText(value as JsonValue);
    expect(richTextSchema.safeParse(result.value).success).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it('stops recursing beyond MAX_RICH_TEXT_DEPTH with a diagnostic, never throwing or hanging', () => {
    let deeplyNestedList: JsonValue = {
      type: 'list',
      version: 1,
      listType: 'bullet',
      children: [],
    };
    for (let i = 0; i < MAX_RICH_TEXT_DEPTH + 20; i++) {
      deeplyNestedList = {
        type: 'list',
        version: 1,
        listType: 'bullet',
        children: [{ type: 'listitem', version: 1, children: [deeplyNestedList] }],
      };
    }
    const result = normalizeRichText(root([deeplyNestedList]) as JsonValue);
    expect(richTextSchema.safeParse(result.value).success).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'richtext.max-depth')).toBe(true);
  });

  it('never throws for arbitrary JSON input', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (input) => {
        expect(() => normalizeRichText(input as JsonValue)).not.toThrow();
      }),
    );
  });

  it('never throws for arbitrary, possibly-cyclic-looking deeply nested objects', () => {
    fc.assert(
      fc.property(fc.anything({ maxDepth: 10 }), (input) => {
        expect(() => normalizeRichText(input as JsonValue)).not.toThrow();
      }),
    );
  });
});

describe('plainTextToRichText', () => {
  it('wraps a string in a single paragraph with a single text node', () => {
    expect(plainTextToRichText('Hello world')).toEqual({
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', version: 1, text: 'Hello world', format: 0 }],
        },
      ],
    });
  });

  it('handles an empty string', () => {
    const result = plainTextToRichText('');
    expect(result.children).toHaveLength(1);
    expect(richTextSchema.safeParse(result).success).toBe(true);
  });

  it('caps an oversized string', () => {
    const huge = 'y'.repeat(MAX_RICH_TEXT_STRING_LENGTH + 500);
    const result = plainTextToRichText(huge);
    const text = (result.children[0] as { children: readonly { text: string }[] }).children[0]
      ?.text;
    expect(text).toHaveLength(MAX_RICH_TEXT_STRING_LENGTH);
  });

  it('always produces a value that satisfies richTextSchema', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(richTextSchema.safeParse(plainTextToRichText(text)).success).toBe(true);
      }),
    );
  });
});
