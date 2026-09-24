import { parse } from 'css-tree';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { NodeStyles } from '../document/style-types.ts';
import type { BuilderDocument } from '../document/types.ts';
import { compileStyles } from './compile.ts';
import { compileNodeDeclarations, compileNodeRules } from './compile-node.ts';
import { defaultTheme, defineTheme } from './theme.ts';
import { compileTokens, LAYER_ORDER_CSS } from './tokens.ts';

function docOf(entries: [string, unknown][]): BuilderDocument {
  const nodes: Record<string, unknown> = {
    root: {
      id: 'root',
      type: 'buildr/page',
      slots: { default: entries.map(([id]) => id) },
    },
  };
  for (const [id, styles] of entries) nodes[id] = { id, type: 'buildr/box', styles };
  return { schemaVersion: 1, root: 'root', nodes, components: {} } as unknown as BuilderDocument;
}

/** The node layer of a stylesheet (everything after the tokens). */
const nodesLayer = (css: string) => css.slice(css.indexOf('@layer buildr.nodes'));

const GRID: NodeStyles = {
  base: { layout: { display: 'grid', columns: 3, gap: '$space.8' } },
  bp: {
    tablet: { layout: { columns: 2 } },
    mobile: { layout: { columns: 1 } },
  },
};

function cssErrors(css: string): string[] {
  const errors: string[] = [];
  parse(css, { onParseError: (error) => errors.push(error.message) });
  return errors;
}

describe('compileStyles', () => {
  it('produces the CSS documented in docs/responsive.md', () => {
    const { css, diagnostics } = compileStyles(docOf([['Gx81kLm2Pq', GRID]]), defaultTheme);
    expect(diagnostics).toEqual([]);
    expect(nodesLayer(css)).toBe(
      [
        '@layer buildr.nodes {',
        '  .b-Gx81kLm2Pq { display: grid; gap: var(--b-space-8); grid-template-columns: repeat(3, minmax(0, 1fr)); }',
        '  @media (max-width: 1023.98px) {',
        '    .b-Gx81kLm2Pq { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
        '  }',
        '  @media (max-width: 767.98px) {',
        '    .b-Gx81kLm2Pq { grid-template-columns: repeat(1, minmax(0, 1fr)); }',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('starts with the layer order and the tokens', () => {
    const { css } = compileStyles(docOf([['a', GRID]]), defaultTheme);
    expect(
      css.startsWith(`${LAYER_ORDER_CSS}\n${compileTokens(defaultTheme)}\n@layer buildr.nodes {`),
    ).toBe(true);
  });

  it('emits base rules in pre-order, then states, then one media block per breakpoint', () => {
    const doc = docOf([
      [
        'a',
        { base: { layout: { display: 'flex' } }, bp: { mobile: { layout: { display: 'block' } } } },
      ],
      [
        'b',
        {
          base: { layout: { display: 'grid' } },
          bp: { tablet: { layout: { display: 'flex' } } },
          state: { hover: { effects: { cursor: 'pointer' } } },
        },
      ],
      ['c', { bp: { mobile: { layout: { display: 'none' } }, tablet: { layout: { gap: '0' } } } }],
    ]);
    const lines = nodesLayer(compileStyles(doc, defaultTheme).css).split('\n');
    expect(lines).toEqual([
      '@layer buildr.nodes {',
      '  .b-a { display: flex; }',
      '  .b-b { display: grid; }',
      '  .b-b:hover { cursor: pointer; }',
      '  @media (max-width: 1023.98px) {',
      '    .b-b { display: flex; }',
      '    .b-c { gap: 0; }',
      '  }',
      '  @media (max-width: 767.98px) {',
      '    .b-a { display: block; }',
      '    .b-c { display: none; }',
      '  }',
      '}',
    ]);
  });

  it('emits the tokens alone when no node has styles', () => {
    const { css } = compileStyles(
      docOf([
        ['a', undefined],
        ['b', {}],
      ]),
      defaultTheme,
    );
    expect(css).toBe(`${LAYER_ORDER_CSS}\n${compileTokens(defaultTheme)}`);
  });

  it('compiles box, corner and visibility properties', () => {
    const { css, diagnostics } = compileStyles(
      docOf([
        [
          'a',
          {
            base: {
              spacing: { margin: { left: 'auto', top: '$space.2' }, padding: { bottom: '1rem' } },
              border: {
                width: { top: '1px' },
                radius: { topLeft: '$radius.md', bottomRight: '4px' },
                style: 'solid',
              },
              layout: { inset: { top: '0', right: '0' } },
              visibility: { hidden: true },
            },
          },
        ],
      ]),
      defaultTheme,
    );
    expect(diagnostics).toEqual([]);
    expect(nodesLayer(css)).toContain(
      '.b-a { top: 0; right: 0; margin-top: var(--b-space-2); margin-left: auto; padding-bottom: 1rem; border-top-width: 1px; border-style: solid; border-top-left-radius: var(--b-radius-md); border-bottom-right-radius: 4px; display: none; }',
    );
  });

  it('lets visibility.hidden win over layout.display, and emits nothing for hidden: false', () => {
    const doc = docOf([
      ['a', { base: { layout: { display: 'flex' }, visibility: { hidden: true } } }],
      ['b', { base: { visibility: { hidden: false } } }],
    ]);
    const layer = nodesLayer(compileStyles(doc, defaultTheme).css);
    expect(layer).toContain('.b-a { display: flex; display: none; }');
    expect(layer).not.toContain('.b-b');
  });

  it('does not depend on the order keys were written in', () => {
    const a = docOf([
      [
        'x',
        {
          base: {
            typography: { color: '#fff', fontSize: '1rem' },
            layout: { gap: '0', display: 'flex' },
          },
        },
      ],
    ]);
    const b = docOf([
      [
        'x',
        {
          base: {
            layout: { display: 'flex', gap: '0' },
            typography: { fontSize: '1rem', color: '#fff' },
          },
        },
      ],
    ]);
    expect(compileStyles(a, defaultTheme).css).toBe(compileStyles(b, defaultTheme).css);
    expect(compileStyles(a, defaultTheme).hash).toBe(compileStyles(b, defaultTheme).hash);
  });

  it('is deterministic and the hash tracks both styles and theme', () => {
    const doc = docOf([['a', GRID]]);
    const first = compileStyles(doc, defaultTheme);
    expect(compileStyles(doc, defaultTheme)).toEqual(first);
    const changed = compileStyles(
      docOf([['a', { base: { layout: { display: 'flex' } } }]]),
      defaultTheme,
    );
    expect(changed.hash).not.toBe(first.hash);
    const other = defineTheme({
      breakpoints: [
        { id: 'tablet', maxWidth: 1023 },
        { id: 'mobile', maxWidth: 767 },
      ],
      tokens: { color: { primary: '#000000' } },
    });
    expect(compileStyles(doc, other).hash).not.toBe(first.hash);
  });

  it('follows the theme breakpoints (a media query per configured width)', () => {
    const theme = defineTheme({
      breakpoints: [
        { id: 'wide', maxWidth: 1400 },
        { id: 'small', maxWidth: 480 },
      ],
      tokens: {},
    });
    const doc = docOf([
      ['a', { bp: { small: { layout: { gap: '0' } }, wide: { layout: { gap: '1px' } } } }],
    ]);
    const layer = nodesLayer(compileStyles(doc, theme).css);
    expect(layer.indexOf('1400.98px')).toBeLessThan(layer.indexOf('480.98px'));
  });

  it('reports an unknown breakpoint and skips it', () => {
    const doc = docOf([
      ['a', { base: { layout: { gap: '0' } }, bp: { ultrawide: { layout: { gap: '1px' } } } }],
    ]);
    const { css, diagnostics } = compileStyles(doc, defaultTheme);
    expect(css).not.toContain('@media');
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'style.unknown-breakpoint',
        severity: 'warning',
        details: { nodeId: 'a', breakpoint: 'ultrawide' },
      }),
    ]);
  });

  it('warns about a token the theme does not define but still emits the variable', () => {
    const { css, diagnostics } = compileStyles(
      docOf([['a', { base: { layout: { gap: '$space.99' } } }]]),
      defaultTheme,
    );
    expect(css).toContain('gap: var(--b-space-99)');
    expect(diagnostics[0]).toMatchObject({
      code: 'style.unknown-token',
      severity: 'warning',
      details: { nodeId: 'a', property: 'base.layout.gap' },
    });
  });

  it('skips values that fail their grammar and reports them tagged with node and property', () => {
    const doc = docOf([
      [
        'a',
        {
          base: {
            layout: { display: 'flex', gap: 'red;}body{' },
            typography: { color: 'url(x)' },
            spacing: { margin: { top: '1px', left: 'calc(1px)' } },
          },
        },
      ],
    ]);
    const { css, diagnostics } = compileStyles(doc, defaultTheme);
    expect(nodesLayer(css)).toContain('.b-a { display: flex; margin-top: 1px; }');
    expect(nodesLayer(css)).not.toMatch(/red|url|calc|body/);
    expect(diagnostics.map((d) => [d.code, d.details])).toEqual([
      ['style.invalid-value', { nodeId: 'a', property: 'base.layout.gap' }],
      ['style.invalid-value', { nodeId: 'a', property: 'base.spacing.margin.left' }],
      ['style.invalid-value', { nodeId: 'a', property: 'base.typography.color' }],
    ]);
  });

  it('reports unknown groups, properties, sides and pseudo-states instead of emitting them', () => {
    const doc = docOf([
      [
        'a',
        {
          base: {
            nope: {},
            layout: { flexBasis: '1px', display: 'flex' },
            spacing: { margin: { middle: '1px' } },
          },
          state: { focus: {}, hover: { layout: { display: 'none' } } },
        },
      ],
    ]);
    const { css, diagnostics } = compileStyles(doc, defaultTheme);
    expect(nodesLayer(css)).toBe('@layer buildr.nodes {\n  .b-a { display: flex; }\n}');
    expect(diagnostics.map((d) => d.code).sort()).toEqual([
      'style.not-allowed-in-state',
      'style.unknown-property',
      'style.unknown-property',
      'style.unknown-property',
      'style.unknown-property',
    ]);
  });

  it('never emits a node whose id cannot be a class name', () => {
    for (const id of ['a b', 'a.b', 'a{}', 'a;b', '', 'x'.repeat(65), 'a>b', 'é']) {
      const doc = docOf([[id, { base: { layout: { display: 'flex' } } }]]);
      const { css, diagnostics } = compileStyles(doc, defaultTheme);
      expect(css).not.toContain('.b-');
      expect(diagnostics[0]?.code).toBe('style.invalid-node-id');
    }
  });

  it('ignores unreachable nodes and survives malformed style containers', () => {
    const doc = docOf([
      ['a', null],
      ['b', 'x'],
      ['c', []],
      ['d', { base: 'x', bp: 3, state: [] }],
    ]);
    expect(() => compileStyles(doc, defaultTheme)).not.toThrow();
    const orphan = {
      ...doc,
      nodes: {
        ...doc.nodes,
        z: { id: 'z', type: 'buildr/box', styles: { base: { layout: { gap: '0' } } } },
      },
    } as unknown as BuilderDocument;
    expect(compileStyles(orphan, defaultTheme).css).not.toContain('.b-z');
  });
});

describe('output safety', () => {
  const values = fc.oneof(
    fc.constantFrom(
      'flex',
      'grid',
      '1px',
      '$space.4',
      '#fff',
      'auto',
      'none',
      'inherit',
      'red;}body{',
      'url(x)',
      'calc(1px)',
      '1px !important',
      3,
      -1,
      true,
      null,
      {},
      [],
    ),
    fc.string({ maxLength: 20 }),
  );
  const group = fc.dictionary(
    fc.constantFrom(
      'display',
      'gap',
      'color',
      'columns',
      'margin',
      'width',
      'hidden',
      'radius',
      'shadow',
      'gradient',
      'fontSize',
      'weird',
    ),
    fc.oneof(
      values,
      fc.dictionary(fc.constantFrom('top', 'left', 'topLeft', 'x'), values, { maxKeys: 3 }),
    ),
    { maxKeys: 5 },
  );
  const decl = fc.dictionary(
    fc.constantFrom(
      'layout',
      'size',
      'spacing',
      'typography',
      'background',
      'border',
      'effects',
      'visibility',
      'bogus',
    ),
    fc.oneof(group, values),
    { maxKeys: 5 },
  );
  const styles = fc.record(
    {
      base: fc.oneof(decl, values),
      bp: fc.dictionary(fc.constantFrom('tablet', 'mobile', 'huge'), decl, { maxKeys: 3 }),
      state: fc.dictionary(fc.constantFrom('hover', 'active', 'focus-visible', 'other'), decl, {
        maxKeys: 3,
      }),
    },
    { requiredKeys: [] },
  );

  it('never emits anything outside the grammar, and the CSS always parses', () => {
    fc.assert(
      fc.property(fc.array(styles, { minLength: 1, maxLength: 4 }), (list) => {
        const doc = docOf(list.map((s, i) => [`n${i}`, s]));
        const { css } = compileStyles(doc, defaultTheme);
        const layer = nodesLayer(css);
        expect(cssErrors(css)).toEqual([]);
        expect(layer).not.toMatch(
          /!important|url\s*\(|expression|calc\s*\(|javascript|\\|["'<>`]/i,
        );
        // Every declaration is `property: value` from the registry, and braces only structure rules.
        for (const line of layer.split('\n')) {
          const rule = /^ {2,4}\.b-n\d(?::[a-z-]+)? \{ ([^{}]*); \}$/.exec(line);
          if (rule === null) continue;
          for (const declaration of (rule[1] as string).split('; ')) {
            expect(declaration).toMatch(/^[a-z-]+: [^;{}]+$/);
          }
        }
      }),
      { numRuns: 400 },
    );
  });
});

describe('caching and cost', () => {
  it('memoizes on the identity of styles and theme', () => {
    const styles: NodeStyles = { base: { layout: { display: 'flex' } } };
    const first = compileNodeDeclarations(styles, defaultTheme);
    expect(compileNodeDeclarations(styles, defaultTheme)).toBe(first);
    expect(compileNodeDeclarations({ ...styles }, defaultTheme)).not.toBe(first);
    const other = defineTheme({ breakpoints: [], tokens: {} });
    expect(compileNodeDeclarations(styles, other)).not.toBe(first);
    expect(compileNodeDeclarations(styles, other)).toEqual(first);
  });

  it('compileNodeRules returns selector-qualified rules for one node', () => {
    const rules = compileNodeRules(
      'abc',
      {
        base: { layout: { gap: '0' } },
        bp: { mobile: { layout: { gap: '1px' } } },
        state: { hover: { effects: { opacity: 0.5 } } },
      },
      defaultTheme,
    );
    expect(rules.base).toBe('.b-abc { gap: 0; }');
    expect(rules.bp).toEqual({ mobile: '.b-abc { gap: 1px; }' });
    expect(rules.state).toEqual({ hover: '.b-abc:hover { opacity: 0.5; }' });
    expect(compileNodeRules('a b', {}, defaultTheme).diagnostics[0]?.code).toBe(
      'style.invalid-node-id',
    );
  });

  function bigDoc(count: number) {
    return docOf(
      Array.from({ length: count }, (_, i) => [
        `n${i}`,
        {
          base: {
            layout: { display: 'flex', direction: 'column', gap: '$space.4', align: 'center' },
            spacing: { padding: { top: '$space.8', bottom: '$space.8' } },
            typography: { fontSize: '$fontSize.lg', color: '$color.text' },
            background: { color: '$color.surface' },
          },
          bp: {
            tablet: { layout: { gap: '$space.2' } },
            mobile: { layout: { direction: 'column' }, visibility: { hidden: i % 7 === 0 } },
          },
        },
      ]),
    );
  }

  it('compiles 1000 nodes quickly, and instantly when nothing changed', () => {
    const doc = bigDoc(1000);
    const cold = performance.now();
    const first = compileStyles(doc, defaultTheme);
    const coldMs = performance.now() - cold;
    const warm = performance.now();
    const second = compileStyles(doc, defaultTheme);
    const warmMs = performance.now() - warm;
    expect(second.css).toBe(first.css);
    expect(first.diagnostics).toEqual([]);
    expect(coldMs).toBeLessThan(500);
    expect(warmMs).toBeLessThan(10);
  });

  it('recompiles only the edited node after a change', () => {
    const doc = bigDoc(1000);
    compileStyles(doc, defaultTheme);
    const edited = {
      ...doc,
      nodes: { ...doc.nodes, n5: { ...doc.nodes.n5, styles: { base: { layout: { gap: '0' } } } } },
    } as unknown as BuilderDocument;
    const start = performance.now();
    const { css } = compileStyles(edited, defaultTheme);
    expect(performance.now() - start).toBeLessThan(150);
    expect(css).toContain('.b-n5 { gap: 0; }');
  });

  it('keeps the payload within budget', () => {
    const { css } = compileStyles(bigDoc(1000), defaultTheme);
    // ~330 bytes of node CSS per fully styled node; a regression that bloats the output fails here.
    expect(css.length).toBeLessThan(450_000);
    expect(css.length / 1000).toBeLessThan(450);
  });
});
