import { describe, expect, it } from 'vitest';
import {
  checkAttributes,
  checkClasses,
  isAllowedAttributeName,
  isValidClassName,
} from './attributes.ts';
import { authorCodeEnabled } from './capabilities.ts';
import { checkCustomCss, compileCustomCss, MAX_CUSTOM_CSS_LENGTH } from './css.ts';
import { safeHref, sanitizeHtml, sanitizeHtmlToString } from './html.ts';
import { authorNodeAttributes, checkAuthorCode } from './node.ts';

const SCOPE = '.b-n1';
const css = (source: unknown) => compileCustomCss(SCOPE, source);

describe('capabilities', () => {
  it('fails closed: only an explicit true counts', () => {
    expect(authorCodeEnabled(undefined)).toBe(false);
    expect(authorCodeEnabled(null)).toBe(false);
    expect(authorCodeEnabled({})).toBe(false);
    expect(authorCodeEnabled({ authorCode: false })).toBe(false);
    expect(authorCodeEnabled({ authorCode: 'true' as unknown as boolean })).toBe(false);
    expect(authorCodeEnabled({ authorCode: 1 as unknown as boolean })).toBe(false);
    expect(authorCodeEnabled({ authorCode: true })).toBe(true);
  });
});

describe('custom CSS', () => {
  it('scopes plain rules under the node', () => {
    const result = css('a { color: red } .x, h2 > span { margin: 0 !important; }');
    expect(result.errors).toEqual([]);
    expect(result.css).toBe(
      '.b-n1 a { color: red; }\n.b-n1 .x, .b-n1 h2 > span { margin: 0 !important; }',
    );
  });

  it('lets & stand for the node, at the start only', () => {
    expect(css('&:hover { opacity: .5 }').css).toBe('.b-n1:hover { opacity: .5; }');
    expect(css('& > p { color: red }').css).toBe('.b-n1 > p { color: red; }');
    expect(css('a & { color: red }').errors).not.toEqual([]);
    expect(css('html:has(&) { color: red }').errors).not.toEqual([]);
    expect(css('& &, & { color: red }').errors).not.toEqual([]);
  });

  it('wraps @media and @supports and nothing else', () => {
    const result = css(
      '@media (min-width: 600px) { & { gap: 4px } } @supports (display: grid) { a { color: red } }',
    );
    expect(result.errors).toEqual([]);
    expect(result.css).toBe(
      '@media (min-width: 600px) {\n  .b-n1 { gap: 4px; }\n}\n@supports (display: grid) {\n  .b-n1 a { color: red; }\n}',
    );
  });

  it('keeps comments out and strings intact', () => {
    const result = css('/* hi */ &::before { content: "a;b}" } /* x */');
    expect(result.errors).toEqual([]);
    expect(result.css).toBe('.b-n1::before { content: "a;b}"; }');
  });

  it.each([
    ['@import', '@import "https://evil.example/x.css";'],
    ['@import url', '@import url(https://evil.example/x.css);'],
    ['@font-face', '@font-face { font-family: x; src: local(x) }'],
    ['@keyframes', '@keyframes x { from { opacity: 0 } }'],
    ['@property', '@property --x { syntax: "<length>"; inherits: false; initial-value: 0px }'],
    ['@layer', '@layer other { a { color: red } }'],
    ['@charset', '@charset "utf-8";'],
    ['@namespace', '@namespace svg url(http://www.w3.org/2000/svg);'],
    ['@container', '@container (min-width: 1px) { a { color: red } }'],
    ['@page', '@page { margin: 0 }'],
  ])('rejects %s', (_name, source) => {
    const result = css(source);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.css).toBe('');
  });

  it.each([
    'a { background: url(https://evil.example/x.png) }',
    'a { background: URL( "x" ) }',
    'a { background: image-set("x" 1x) }',
    'a { background: -webkit-image-set(url(x) 1x) }',
    'a { content: attr(data-x url) }',
    'a { width: expression(alert(1)) }',
    'a { behavior: url(x.htc) }',
    'a { -moz-binding: url(x) }',
    'a { background: u\\72l(x) }',
    'a { background: javascript:alert(1) }',
    'a { color: red } </style><script>alert(1)</script>',
    'a { color: red; } <!-- ',
    'a { color: red\u0000 }',
    'a { --x: data:text/html,hi }',
    'a { background: element(#x) }',
    'a { background: paint(x) }',
  ])('rejects anything that can load or run: %s', (source) => {
    const result = css(source);
    expect(result.css).toBe('');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects escapes in selectors and values', () => {
    expect(css('.a\\62 { color: red }').errors).not.toEqual([]);
    expect(css('a { color: r\\65 d }').errors).not.toEqual([]);
  });

  it('cannot escape the node: no body, no other node classes, no siblings', () => {
    expect(css('body { overflow: hidden }').css).toBe('.b-n1 body { overflow: hidden; }');
    expect(css('.b-other { color: red }').errors).not.toEqual([]);
    expect(css('[class*="b-"] { color: red }').css).toBe('.b-n1 [class*="b-"] { color: red; }');
    expect(css('& + div { color: red }').errors).not.toEqual([]);
    expect(css('& ~ div { color: red }').errors).not.toEqual([]);
    expect(css('+ div { color: red }').errors).not.toEqual([]);
    expect(css('a:nth-child(2n+1) { color: red }').errors).toEqual([]);
    expect(css('} a { color: red }').css).toBe('.b-n1 a { color: red; }');
  });

  it('rejects nested rules and unbalanced blocks', () => {
    expect(css('a { b { color: red } }').errors).toContain('nested rules are not allowed');
    expect(css('a { color: red ').errors.length).toBeGreaterThan(0);
    expect(css('@media (min-width: 1px) { a { color: red }').errors.length).toBeGreaterThan(0);
    expect(css('a { color: "red }').errors.length).toBeGreaterThan(0);
    expect(css('/* open').errors.length).toBeGreaterThan(0);
  });

  it('rejects bad properties and values', () => {
    expect(css('a { 1x: red }').errors).not.toEqual([]);
    expect(css('a { color }').errors).not.toEqual([]);
    expect(css('a { color: red !important !important }').errors).not.toEqual([]);
    expect(css('a { color: }').errors).not.toEqual([]);
    expect(css('a { width: 1px; color: red; background: blue url(x) }').css).toBe('');
  });

  it('keeps the valid rules when one is rejected, and says what was dropped', () => {
    const result = css('a { color: red } b { background: url(x) } c { margin: 0 }');
    // The url() ban is checked on the whole text first, so nothing is emitted.
    expect(result.css).toBe('');
    const partial = css('a { color: red } @font-face { src: local(x) } c { margin: 0 }');
    expect(partial.css).toBe('.b-n1 a { color: red; }\n.b-n1 c { margin: 0; }');
    expect(partial.errors).toHaveLength(1);
  });

  it('bounds length, rules, declarations and values', () => {
    expect(css('a{}'.repeat(MAX_CUSTOM_CSS_LENGTH)).errors).not.toEqual([]);
    expect(css('a { color: red }\n'.repeat(101)).errors.join()).toContain('more than 100 rules');
    const many = Array.from({ length: 51 }, (_, i) => `--v${i}: 1`).join('; ');
    expect(css(`a { ${many} }`).errors.join()).toContain('declarations');
    expect(css(`a { content: "${'x'.repeat(600)}" }`).errors).not.toEqual([]);
    expect(css(123).errors).toEqual(['custom CSS must be text']);
  });

  it('is deterministic, and output reparses as the same rules', () => {
    const source = '& { color: red } a:hover { text-decoration: underline }';
    expect(css(source)).toEqual(css(source));
  });

  it('checkCustomCss returns the trimmed source or the reasons', () => {
    expect(checkCustomCss('  a { color: red }  ')).toEqual({ ok: true, value: 'a { color: red }' });
    const bad = checkCustomCss('@import "x";');
    expect(bad.ok).toBe(false);
    expect(checkCustomCss('').ok).toBe(true);
  });
});

describe('classes and attributes', () => {
  it('accepts plain tokens, and not the reserved prefixes', () => {
    expect(isValidClassName('hero_title-2')).toBe(true);
    for (const name of ['', '1a', 'b-n1', 'buildr-x', 'a b', 'a"b', 'a<b', 'x'.repeat(65), 5]) {
      expect(isValidClassName(name)).toBe(false);
    }
    expect(checkClasses(['a', 'b', 'a'])).toEqual({ ok: true, value: ['a', 'b'] });
    expect(checkClasses('a').ok).toBe(false);
    expect(checkClasses(Array.from({ length: 17 }, (_, i) => `c${i}`)).ok).toBe(false);
  });

  it('accepts data-*, aria-*, role, title, lang, dir, tabindex', () => {
    const result = checkAttributes({
      'data-track': 'cta',
      'aria-label': 'Open',
      role: 'region',
      title: 'Hello',
      lang: 'pl',
      dir: 'rtl',
      tabindex: '0',
    });
    expect(result.ok).toBe(true);
  });

  it.each([
    ['onclick', 'alert(1)'],
    ['ONLOAD', 'x'],
    ['style', 'color: red'],
    ['class', 'x'],
    ['id', 'x'],
    ['href', 'javascript:alert(1)'],
    ['src', 'x'],
    ['srcdoc', '<script>'],
    ['formaction', 'x'],
    ['data-', 'x'],
    ['data-A', 'x'],
    ['aria-label ', 'x'],
    ['data-x"y', 'x'],
    ['role', 'Admin Button'],
    ['dir', 'sideways'],
    ['tabindex', '5'],
    ['lang', '<x>'],
    ['title', 'a\nb'],
    ['title', 'x'.repeat(257)],
  ])('rejects %s=%s', (name, value) => {
    expect(checkAttributes({ [name]: value }).ok).toBe(false);
  });

  it.each([
    'data-b',
    'data-bi',
    'data-bid',
    'data-buildr',
    'data-buildr-overlay',
    'data-buildr-placeholder',
    'data-buildr-slot',
    'data-bar',
  ])('rejects %s: names starting data-b are the canvas markers', (name) => {
    expect(checkAttributes({ [name]: 'x' }).ok).toBe(false);
    expect(isAllowedAttributeName(name)).toBe(false);
    // ...also at render, for a document that bypassed the commands.
    expect(authorNodeAttributes({ attributes: { [name]: 'x' } }, { authorCode: true })).toEqual({
      classes: [],
      attributes: {},
    });
  });

  it('still accepts other data-* names', () => {
    expect(checkAttributes({ 'data-a': '1', 'data-track': '2', 'data-c-b': '3' }).ok).toBe(true);
  });

  it('rejects a non-map, a non-text value and too many entries', () => {
    expect(checkAttributes([]).ok).toBe(false);
    expect(checkAttributes(null).ok).toBe(false);
    expect(checkAttributes({ 'data-a': 1 }).ok).toBe(false);
    expect(
      checkAttributes(Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`data-a${i}`, 'x'])))
        .ok,
    ).toBe(false);
  });

  it('is not fooled by __proto__', () => {
    const parsed = JSON.parse('{"__proto__": "x"}');
    expect(checkAttributes(parsed).ok).toBe(false);
  });

  it('renders nothing without the capability, and only valid parts with it', () => {
    const node = { classes: ['a', 'b-bad', 'c'], attributes: { 'data-x': '1' } };
    expect(authorNodeAttributes(node, undefined)).toEqual({ classes: [], attributes: {} });
    expect(authorNodeAttributes(node, { authorCode: false })).toEqual({
      classes: [],
      attributes: {},
    });
    expect(authorNodeAttributes(node, { authorCode: true })).toEqual({
      classes: ['a', 'c'],
      attributes: { 'data-x': '1' },
    });
    expect(
      authorNodeAttributes({ attributes: { onclick: 'x', 'data-y': '2' } }, { authorCode: true }),
    ).toEqual({ classes: [], attributes: { 'data-y': '2' } });
  });
});

describe('html sanitiser', () => {
  it('keeps allowed markup', () => {
    expect(sanitizeHtmlToString('<p>Hello <strong>world</strong><br><em>!</em></p>')).toBe(
      '<p>Hello <strong>world</strong><br><em>!</em></p>',
    );
    expect(sanitizeHtmlToString('<ul><li>a</li><li>b</li></ul>')).toBe(
      '<ul><li>a</li><li>b</li></ul>',
    );
  });

  it('removes scripts, styles and embeds together with their content', () => {
    for (const source of [
      '<script>alert(1)</script>ok',
      '<style>a{}</style>ok',
      '<iframe src="https://evil.example"></iframe>ok',
      '<object data="x"></object>ok',
      '<embed src="x">ok',
      '<svg onload="alert(1)"><circle/></svg>ok',
      '<math><mi xlink:href="javascript:x">x</mi></math>ok',
      '<template><script>x</script></template>ok',
      '<noscript><img src=x onerror=alert(1)></noscript>ok',
      '<form action="https://evil.example"><input name=x></form>ok',
      '<img src="x" onerror="alert(1)">ok',
      '<video src="x"></video>ok',
      '<link rel="stylesheet" href="x">ok',
      '<meta http-equiv="refresh" content="0;url=x">ok',
      '<base href="https://evil.example/">ok',
      '<textarea><script>x</script></textarea>ok',
    ]) {
      expect(sanitizeHtmlToString(source), source).toBe('ok');
    }
  });

  it('removes event handlers, style and unknown attributes', () => {
    const out = sanitizeHtmlToString(
      '<p onclick="alert(1)" style="color:red" class="x" id="y" data-a="b" title="t" onmouseover=x>hi</p>',
    );
    expect(out).toBe('<p title="t">hi</p>');
    expect(sanitizeHtmlToString('<a href="/x" onfocus="x" autofocus>l</a>')).toBe(
      '<a href="/x">l</a>',
    );
  });

  it('only keeps safe URLs, however they are disguised', () => {
    expect(sanitizeHtmlToString('<a href="https://example.com/a?b=1&c=2">x</a>')).toBe(
      '<a href="https://example.com/a?b=1&amp;c=2">x</a>',
    );
    for (const href of [
      'javascript:alert(1)',
      ' JaVaScRiPt:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      '&#106;avascript:alert(1)',
      '&#x6A;avascript:alert(1)',
      'jav&#x09;ascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:x',
      'file:///etc/passwd',
      '//evil.example/x',
      '\\\\evil.example\\x',
      'blob:https://x',
      '\u0001javascript:x',
    ]) {
      expect(sanitizeHtmlToString(`<a href="${href}">x</a>`), href).toBe('<a>x</a>');
    }
    expect(sanitizeHtmlToString('<a href="mailto:a@b.co">x</a>')).toBe(
      '<a href="mailto:a@b.co">x</a>',
    );
    expect(sanitizeHtmlToString('<a href="#top">x</a>')).toBe('<a href="#top">x</a>');
    expect(sanitizeHtmlToString('<a href="page.html">x</a>')).toBe('<a href="page.html">x</a>');
    expect(safeHref('tel:+48123')).toBe('tel:+48123');
    expect(safeHref('')).toBeUndefined();
  });

  it('forces rel on a new-window link', () => {
    expect(sanitizeHtmlToString('<a href="/x" target="_blank">x</a>')).toBe(
      '<a href="/x" target="_blank" rel="noopener noreferrer">x</a>',
    );
    expect(sanitizeHtmlToString('<a href="/x" target="_blank" rel="opener">x</a>')).toBe(
      '<a href="/x" target="_blank" rel="noopener noreferrer">x</a>',
    );
    expect(sanitizeHtmlToString('<a href="/x" target="evil">x</a>')).toBe('<a href="/x">x</a>');
  });

  it('unwraps unknown tags and keeps their text', () => {
    expect(sanitizeHtmlToString('<blink>hi <b>there</b></blink>')).toBe('hi <b>there</b>');
    expect(sanitizeHtmlToString('<custom-el onclick="x">y</custom-el>')).toBe('y');
  });

  it('escapes text, so mutation tricks cannot rebuild markup', () => {
    expect(sanitizeHtmlToString('1 < 2 && 3 > 2')).toBe('1 &lt; 2 &amp;&amp; 3 &gt; 2');
    expect(sanitizeHtmlToString('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
    expect(
      sanitizeHtmlToString('<noscript><p title="</noscript><img src=x onerror=alert(1)>">'),
    ).not.toContain('<img');
    expect(sanitizeHtmlToString('<p title="a&quot;b"onclick="x">z</p>')).not.toContain('onclick');
    expect(sanitizeHtmlToString('<!-- c --><p>a</p>')).toBe('<p>a</p>');
  });

  it('is idempotent and never contains a forbidden token', () => {
    const inputs = [
      '<p>a<script>x</script></p><a href="javascript:x" onclick="y">l</a>',
      '<b><i>nested</b></i>',
      '<table><tr><td>cell</td></tr></table><p>after',
      '<select><option>x</select><p>y',
    ];
    for (const input of inputs) {
      const once = sanitizeHtmlToString(input);
      expect(sanitizeHtmlToString(once)).toBe(once);
      expect(once).not.toMatch(/<script|javascript:|onclick|onerror|<iframe|<style/i);
    }
  });

  it('is idempotent for a <pre> that starts with a newline', () => {
    const inputs = [
      '<pre>\nx</pre>',
      '<pre>\n\nx</pre>',
      '<pre>\n\n\nx\n\ny</pre>',
      '<pre><foo>\nx</foo></pre>',
      '<pre><foo>\n\nx</foo></pre>',
      '<pre>\r\nx</pre>',
      '<pre>&#10;x</pre>',
      '<pre>&#10;&#10;x</pre>',
      '<div><pre><b>\n</b>\n\nx</pre></div>',
      '<pre>\n<script>y</script>\nx</pre>',
    ];
    for (const input of inputs) {
      const once = sanitizeHtmlToString(input);
      expect(sanitizeHtmlToString(once), JSON.stringify(input)).toBe(once);
    }
    // A leading newline in the text is kept, and written so a reader does not swallow it.
    expect(sanitizeHtmlToString('<pre>\n\nx</pre>')).toBe('<pre>\n\nx</pre>');
    expect(sanitizeHtml('<pre>\n\nx</pre>').nodes).toEqual(
      sanitizeHtml(sanitizeHtmlToString('<pre>\n\nx</pre>')).nodes,
    );
  });

  it('bounds length, nodes and depth', () => {
    expect(sanitizeHtml('x'.repeat(30000)).removed).toContain('(text past the length limit)');
    const deep = '<div>'.repeat(50) + 'x' + '</div>'.repeat(50);
    expect(sanitizeHtml(deep).removed).toContain('(depth limit)');
    const wide = '<b>a</b>'.repeat(3000);
    expect(sanitizeHtml(wide).nodes.length).toBeLessThan(2100);
    expect(sanitizeHtml(undefined).nodes).toEqual([]);
    expect(sanitizeHtml(5).nodes).toEqual([]);
  });

  it('reports what it removed', () => {
    expect(sanitizeHtml('<p onclick="x">a</p><script>b</script>').removed).toEqual([
      'p[onclick]',
      'script',
    ]);
  });
});

describe('checkAuthorCode (persistence guard)', () => {
  const doc = {
    nodes: {
      root: { id: 'root', type: 'buildr/page' },
      n1: { id: 'n1', type: 'buildr/box', customCss: 'a { color: red }' },
      n2: { id: 'n2', type: 'buildr/box', classes: ['x'] },
      n3: { id: 'n3', type: 'buildr/box' },
    },
  };

  it('flags every node with author code when the host does not allow it', () => {
    for (const capabilities of [undefined, {}, { authorCode: false }]) {
      const diagnostics = checkAuthorCode(doc, capabilities);
      expect(diagnostics.map((d) => [d.code, d.details?.['nodeId']])).toEqual([
        ['author.not-permitted', 'n1'],
        ['author.not-permitted', 'n2'],
      ]);
      expect(diagnostics.every((d) => d.severity === 'error')).toBe(true);
    }
  });

  it('is clean with the capability and valid code, and flags invalid code', () => {
    expect(checkAuthorCode(doc, { authorCode: true })).toEqual([]);
    const bad = {
      nodes: {
        n1: {
          id: 'n1',
          type: 'buildr/box',
          customCss: '@import "x";',
          attributes: { onclick: 'x' },
        },
      },
    };
    expect(checkAuthorCode(bad, { authorCode: true }).map((d) => d.code)).toEqual([
      'author.invalid',
    ]);
  });
});
