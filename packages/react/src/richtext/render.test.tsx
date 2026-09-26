import { readdirSync, readFileSync } from 'node:fs';
import type { Diagnostic } from '@next-buildr/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { platform } from '../render/render.test-kit.tsx';
import { richTextConverters, TEXT_FORMAT } from './converters.tsx';
import { MAX_RICH_TEXT_NODES, type RenderRichTextOptions, renderRichText } from './render.tsx';

const t = (text: string, format = 0) => ({ type: 'text', version: 1, text, format });
const root = (...children: unknown[]) => ({ type: 'root', version: 1, children });
const para = (...children: unknown[]) => ({ type: 'paragraph', version: 1, children });
const a = (url: string, ...children: unknown[]) => ({ type: 'link', version: 1, url, children });

function run(value: unknown, options: RenderRichTextOptions = {}) {
  const diagnostics: Diagnostic[] = [];
  const out = renderToStaticMarkup(<>{renderRichText(value, { ...options, diagnostics })}</>);
  return { out, codes: diagnostics.map((d) => d.code) };
}

describe('renderRichText', () => {
  it('renders the supported nodes', () => {
    const doc = root(
      { type: 'heading', version: 1, tag: 'h2', children: [t('Title')] },
      para(t('one '), t('two', TEXT_FORMAT.bold), { type: 'linebreak', version: 1 }, t('three')),
      {
        type: 'list',
        version: 1,
        listType: 'bullet',
        children: [{ type: 'listitem', version: 1, children: [t('a')] }],
      },
      {
        type: 'list',
        version: 1,
        listType: 'number',
        children: [
          {
            type: 'listitem',
            version: 1,
            children: [
              t('b'),
              {
                type: 'list',
                version: 1,
                listType: 'bullet',
                children: [{ type: 'listitem', version: 1, children: [t('nested')] }],
              },
            ],
          },
        ],
      },
      { type: 'quote', version: 1, children: [t('quoted')] },
    );
    expect(run(doc).out).toBe(
      '<h2>Title</h2><p>one <strong>two</strong><br/>three</p><ul><li>a</li></ul>' +
        '<ol><li>b<ul><li>nested</li></ul></li></ol><blockquote>quoted</blockquote>',
    );
  });

  it('applies the text format bitmask in a fixed order', () => {
    const all = Object.values(TEXT_FORMAT).reduce((x, y) => x | y, 0);
    expect(run(root(para(t('x', all)))).out).toBe(
      '<p><strong><em><s><u><sup><sub><code>x</code></sub></sup></u></s></em></strong></p>',
    );
    expect(run(root(para(t('x', TEXT_FORMAT.italic | TEXT_FORMAT.code)))).out).toBe(
      '<p><em><code>x</code></em></p>',
    );
  });

  it('escapes text', () => {
    const { out } = run(root(para(t('<script>alert(1)</script> & "q"'))));
    expect(out).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;</p>');
  });

  describe('links', () => {
    it('go through platform.Link when there is one', () => {
      const { out } = run(root(para(a('/about', t('About')))), { platform });
      expect(out).toBe('<p><a href="/about" data-platform="link">About</a></p>');
    });

    it('are plain anchors without a platform', () => {
      expect(run(root(para(a('https://example.com', t('x'))))).out).toBe(
        '<p><a href="https://example.com">x</a></p>',
      );
    });

    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      '\u0000javascript:alert(1)',
    ])('drop an unsafe URL and keep the text: %j', (url) => {
      const { out, codes } = run(root(para(a(url, t('click')))), { platform });
      expect(out).toBe('<p>click</p>');
      expect(out).not.toContain('href');
      expect(codes).toHaveLength(1);
    });

    it('keep the text of a link without a URL', () => {
      const { out } = run(root(para({ type: 'link', version: 1, children: [t('x')] })));
      expect(out).toBe('<p>x</p>');
    });

    it('ignore an inherited url property', () => {
      const node = Object.create({ url: 'javascript:alert(1)' }) as Record<string, unknown>;
      node['type'] = 'link';
      node['children'] = [t('x')];
      expect(run(root(para(node))).out).toBe('<p>x</p>');
    });
  });

  describe('untrusted input', () => {
    it('drops unknown node types, with their children', () => {
      const { out, codes } = run(
        root(
          para(t('kept')),
          { type: 'script', children: [t('evil')] },
          { type: 'upload', value: { id: 1 } },
          { type: 'toString', children: [t('evil')] },
          { type: 'constructor' },
          { type: '__proto__' },
          { children: [] },
        ),
      );
      expect(out).toBe('<p>kept</p>');
      expect(codes).toEqual(Array(6).fill('richtext.unknown-node'));
    });

    it('rejects a heading with a tag outside h1-h6', () => {
      const { out, codes } = run(
        root({ type: 'heading', version: 1, tag: 'script', children: [t('x')] }),
      );
      expect(out).toBe('');
      expect(codes).toEqual(['richtext.invalid-node']);
    });

    it('ignores non-string text and bad format values', () => {
      const { out } = run(
        root(para({ type: 'text', text: 5 }, t('a', -3), t('b', 1.5), t('c', Number.NaN))),
      );
      expect(out).toBe('<p>abc</p>');
    });

    it.each([
      ['a string', 'text'],
      ['an array', []],
      ['a non-root object', { type: 'paragraph', children: [] }],
    ])('renders nothing for %s', (_n, value) => {
      const { out, codes } = run(value);
      expect(out).toBe('');
      expect(codes).toEqual(['richtext.invalid']);
    });

    it('renders nothing, silently, for null and undefined', () => {
      expect(run(null)).toEqual({ out: '', codes: [] });
      expect(run(undefined)).toEqual({ out: '', codes: [] });
    });

    it('ignores non-array children and non-object entries', () => {
      const { out } = run(root(para(t('a'), 'str', 7, null, [1]), { type: 'paragraph' }));
      expect(out).toBe('<p>a</p><p></p>');
    });

    it('cuts nesting at the maximum depth', () => {
      let node: unknown = t('deep');
      for (let i = 0; i < 100; i++) node = { type: 'quote', version: 1, children: [node] };
      const { out, codes } = run(root(node));
      expect(codes).toContain('richtext.max-depth');
      expect(out).not.toContain('deep');
    });

    it('cuts a value with too many nodes', () => {
      const many = Array.from({ length: MAX_RICH_TEXT_NODES + 50 }, () => t('x'));
      const { codes } = run(root(para(...many)));
      expect(codes).toContain('richtext.too-large');
    });
  });

  describe('converters', () => {
    it('can be added and replaced, without changing the defaults', () => {
      const custom = {
        upload: () => <hr />,
        quote: (_n: unknown, ctx: { children: (n: unknown, p: readonly []) => unknown }) => (
          <aside>{ctx.children([t('replaced')], []) as never}</aside>
        ),
      };
      const { out, codes } = run(
        root({ type: 'upload' }, { type: 'quote', version: 1, children: [] }),
        { converters: custom as never },
      );
      expect(out).toBe('<hr/><aside>replaced</aside>');
      expect(codes).toEqual([]);
      expect(Object.keys(richTextConverters)).not.toContain('upload');
      expect(run(root({ type: 'upload' })).codes).toEqual(['richtext.unknown-node']);
    });
  });

  it('never uses dangerouslySetInnerHTML anywhere in the package sources', () => {
    for (const dir of ['.', '../render', '../server', '../client', '../define', '../canvas']) {
      const base = new URL(`${dir}/`, import.meta.url);
      let files: string[] = [];
      try {
        files = readdirSync(base);
      } catch {
        continue;
      }
      for (const file of files.filter((f) => /\.tsx?$/.test(f) && !f.includes('.test'))) {
        expect(readFileSync(new URL(file, base), 'utf8'), file).not.toContain(
          'dangerouslySetInnerHTML',
        );
      }
    }
  });
});
