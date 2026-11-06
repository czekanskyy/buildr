import { type CssNode, generate, parse, walk } from 'css-tree';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compileCustomCss } from './css.ts';

// A second reader checks the first one. `compileCustomCss` is a hand-written parser; css-tree
// follows the CSS Syntax spec. Whatever the source, the compiled output is reparsed with css-tree
// and every rule must sit inside `@layer buildr.custom` and start with the node scope: if the two
// disagree about where a string or a block ends, a rule escapes and one of these checks fails.

const SCOPE = '.b-n1';
const FF = '\u000c';

/** The problems css-tree finds in `css` once it is wrapped the way the style compiler wraps it. */
function containmentProblems(css: string): string[] {
  const problems: string[] = [];
  const sheet = `@layer buildr.custom {\n${css}\n}\n.after { color: green }`;
  const ast = parse(sheet, { positions: false });
  if (ast.type !== 'StyleSheet') return ['not a stylesheet'];
  const top = ast.children.toArray();
  const [layer, after, ...extra] = top;
  if (
    layer?.type !== 'Atrule' ||
    layer.name !== 'layer' ||
    generate(layer.prelude as CssNode) !== 'buildr.custom'
  ) {
    problems.push('the first top-level node is not @layer buildr.custom');
  }
  if (after?.type !== 'Rule' || generate(after.prelude) !== '.after') {
    problems.push('the rules after the layer are not just the sentinel');
  }
  if (extra.length > 0) problems.push(`${extra.length} extra top-level nodes`);
  if (layer?.type === 'Atrule' && layer.block !== null && layer.block !== undefined) {
    for (const child of layer.block.children.toArray()) {
      const check = (node: CssNode): void => {
        if (node.type === 'Rule') {
          if (node.prelude.type !== 'SelectorList') problems.push('a rule has a raw prelude');
          else {
            for (const selector of node.prelude.children.toArray()) {
              if (selector.type !== 'Selector') {
                problems.push('a selector is raw');
                continue;
              }
              const first = selector.children.first;
              if (first?.type !== 'ClassSelector' || first.name !== SCOPE.slice(1)) {
                problems.push(`selector does not start with the scope: ${generate(selector)}`);
              }
            }
          }
          for (const declaration of node.block.children.toArray()) {
            if (declaration.type !== 'Declaration')
              problems.push(`a rule holds a ${declaration.type}`);
          }
        } else if (node.type === 'Atrule' && (node.name === 'media' || node.name === 'supports')) {
          for (const inner of node.block?.children.toArray() ?? []) check(inner);
        } else {
          problems.push(`unexpected ${node.type} ${node.type === 'Atrule' ? node.name : ''}`);
        }
      };
      check(child);
    }
  }
  // Nothing at all may reach the global scope: every Rule in the sheet is inside the layer or is the sentinel.
  let global = 0;
  walk(ast, {
    visit: 'Rule',
    enter(this: { atrule: unknown }) {
      if (this.atrule === null || this.atrule === undefined) global++;
    },
  });
  if (global !== 1)
    problems.push(`${global} rules outside any at-rule (expected only the sentinel)`);
  return problems;
}

const contained = (source: string): void => {
  const { css } = compileCustomCss(SCOPE, source);
  expect(containmentProblems(css), `${JSON.stringify(source)} -> ${JSON.stringify(css)}`).toEqual(
    [],
  );
};

describe('custom CSS against css-tree', () => {
  const payloads = [
    `a "${FF}" { content: " } body{background:red} p{"; }`,
    `[x='${FF}'] { content: '] } body{color:red} p{'; }`,
    `[x="${FF}"] { content: "] } body{background:red} p{"; }`,
    'a "\r" { content: " } body{background:red} p{"; }',
    "[x='\r'] { content: '] } body{color:red} p{'; }",
    `a { content: "${FF}" } body { background: red } p { content: "" }`,
    `a { content: "x\r\ny" } body { background: red } p { content: "" }`,
    'a { content: "x\ny" } body { background: red } p { content: "" }',
    `@media (min-width: 1px) { a "${FF}" { content: " } } body{background:red} @media (x) { p{"; } }`,
  ];

  it.each(payloads.map((source) => [JSON.stringify(source), source] as const))(
    'keeps every rule in the layer and under the scope: %s',
    (_name, source) => {
      contained(source);
    },
  );

  // One bracket stack, as in the CSS Syntax spec: `[(])` leaves the `[` open to the end of the source.
  const mixedBrackets = [
    'a { color: [(]) } b { color: blue }',
    'a { color: ([)] } b { color: blue }',
    'a { color: [(]) } x] { color: blue }',
    'a { --v: [(]) }',
    'a { color: red; x: [(]); }',
    '[x(]) { color: red } b { color: blue }',
    '[x(]) { color: red }',
    '([)] { color: red }',
    ':is([)]) { color: red }',
    ':is(a, [b)]) { color: red }',
    'a:not([x(]) { color: red } p { color: blue }',
    '@media (x[)] { a { color: red } } body { color: red }',
    'a { color: ) } body { color: red }',
    'a { color: ] } body { color: red }',
    'a[x { color: red } body { color: red }',
    'a { color: (( } body { color: red }',
  ];

  it.each(mixedBrackets.map((source) => [JSON.stringify(source), source] as const))(
    'refuses brackets that do not match, and keeps the output contained: %s',
    (_name, source) => {
      const result = compileCustomCss(SCOPE, source);
      expect(result.errors.length, JSON.stringify(result.css)).toBeGreaterThan(0);
      expect(result.css).not.toContain('body');
      expect(result.css).not.toContain('blue');
      contained(source);
    },
  );

  it('still accepts balanced and nested brackets', () => {
    for (const source of [
      'a:is([x], :not([y])) { color: red }',
      '[x="a(b"] { color: red }',
      "a:not([data-x='[']) { color: red }",
      'a { width: calc((1px + 2px) * 2); background: linear-gradient(to right, red, blue) }',
      'a { margin: min(1px, 2px) }',
      'a:nth-child(2n + 1)::before { content: "(" }',
    ]) {
      const result = compileCustomCss(SCOPE, source);
      expect(result.errors, source).toEqual([]);
      contained(source);
    }
  });

  it('refuses a ":" that is not a pseudo-class, which would glue a declaration onto the selector', () => {
    for (const source of [
      'content: { color: red }',
      ': { color: red }',
      'a: b { color: red }',
      'a:: { color: red }',
      'a::: b { color: red }',
      'a, color: red { color: red }',
    ]) {
      const result = compileCustomCss(SCOPE, source);
      expect(result.css, source).toBe('');
      expect(result.errors.length, source).toBeGreaterThan(0);
    }
    for (const source of [
      'a:hover { color: red }',
      'a::before { color: red }',
      '&:is(a:hover, b::after) { color: red }',
    ]) {
      expect(compileCustomCss(SCOPE, source).errors, source).toEqual([]);
    }
  });

  it('rejects a form feed or carriage return that would end a string early', () => {
    for (const source of payloads.slice(0, 5)) {
      const result = compileCustomCss(SCOPE, source);
      expect(result.css).not.toContain('body');
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('treats CR, CRLF and FF as newlines, like the browser', () => {
    // A comment-free rule split by FF and CR still compiles; the whitespace is collapsed.
    expect(compileCustomCss(SCOPE, `a${FF}b { color: red }`).css).toBe(
      `${SCOPE} a b { color: red; }`,
    );
    expect(compileCustomCss(SCOPE, 'a\r\n> b\r{ color: red }').css).toBe(
      `${SCOPE} a > b { color: red; }`,
    );
  });

  it.each(['\u0000', '\u0001', '\u0008', '\u000b', '\u000e', '\u001f', '\u007f'])(
    'rejects the control character U+%s outright',
    (char) => {
      const result = compileCustomCss(SCOPE, `a { color: red${char} }`);
      expect(result.css).toBe('');
      expect(result.errors).not.toEqual([]);
      const inString = compileCustomCss(SCOPE, `a { content: "x${char}y" }`);
      expect(inString.css).toBe('');
    },
  );

  it('never emits a newline inside a selector', () => {
    const { css } = compileCustomCss(SCOPE, 'a\n\n  b,\n c\n> d { color: red }');
    expect(css).toBe(`${SCOPE} a b, ${SCOPE} c > d { color: red; }`);
  });

  it('does not let & glue onto the node class', () => {
    expect(compileCustomCss(SCOPE, '&2 { color: red }').errors).not.toEqual([]);
    expect(compileCustomCss(SCOPE, '&-x { color: red }').errors).not.toEqual([]);
    expect(compileCustomCss(SCOPE, '&_y, a { color: red }').errors).not.toEqual([]);
    expect(compileCustomCss(SCOPE, '&.x, &[y], &:hover, &#z, &>p { color: red }').errors).toEqual(
      [],
    );
  });

  it('keeps every valid example contained', () => {
    for (const source of [
      '& { color: red } a:hover { text-decoration: underline }',
      '@media (min-width: 600px) { & { gap: 4px } } @supports (display: grid) { a { color: red } }',
      '/* hi */ &::before { content: "a;b}" } /* x */',
      "[data-x='a{b'] { color: red }",
      'a:is(b, c) > d { margin: 0 !important }',
    ]) {
      contained(source);
    }
  });

  it('fuzz: any mix of quotes, braces, backslashes, newlines and form feeds stays contained', () => {
    const piece = fc.constantFrom(
      '"',
      "'",
      '{',
      '}',
      '[',
      ']',
      '(',
      ')',
      '\\',
      '\n',
      '\r',
      '\r\n',
      FF,
      ';',
      ':',
      ',',
      '/*',
      '*/',
      '@media (x) ',
      '@supports (a: b) ',
      '[(])',
      '([)]',
      'a[(])',
      ':is([)])',
      '[x(]) ',
      'a',
      'body',
      ' ',
      'color: red',
      'content: ',
      '&',
      '!important',
    );
    fc.assert(
      fc.property(fc.array(piece, { minLength: 1, maxLength: 40 }), (pieces) => {
        const { css } = compileCustomCss(SCOPE, pieces.join(''));
        expect(containmentProblems(css), JSON.stringify(pieces.join(''))).toEqual([]);
      }),
      // A fixed seed keeps the run reproducible; raise it by hand to explore.
      { numRuns: 4000, seed: 20261106 },
    );
  });

  it('fuzz: a string with a stray newline or form feed between the quotes never escapes', () => {
    const newline = fc.constantFrom('\n', '\r', '\r\n', FF);
    const quote = fc.constantFrom('"', "'");
    fc.assert(
      fc.property(newline, quote, quote, fc.boolean(), (nl, open, close, inSelector) => {
        const source = inSelector
          ? `[x=${open}${nl}${close}] { content: ${close} } body{background:red} p{${close}; }`
          : `a { content: ${open}${nl}${close} } body{background:red} p { content: ${close}${close} }`;
        const { css } = compileCustomCss(SCOPE, source);
        expect(containmentProblems(css), JSON.stringify(source)).toEqual([]);
      }),
      { numRuns: 400 },
    );
  });
});
