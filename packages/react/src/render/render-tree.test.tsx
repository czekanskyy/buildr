import { readdirSync, readFileSync } from 'node:fs';
import { bind, type Diagnostic, expr, type PageNode, s } from '@next-buildr/core';
import { Fragment, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { withNodeIds } from './instrument.ts';
import {
  ClientProbe,
  dataContext,
  doc,
  emptyData,
  ID,
  node,
  options,
  registry,
} from './render.test-kit.tsx';
import { renderTree } from './render-tree.ts';
import type { CanvasInstrumentation } from './types.ts';

const html = (element: ReactNode) => renderToStaticMarkup(<>{element}</>);
const render = (...args: Parameters<typeof renderTree>) => html(renderTree(...args));

describe('renderTree', () => {
  describe('structure', () => {
    it('renders slots recursively with no wrapper elements', () => {
      const d = doc(
        [
          node(1, 'buildr/section'),
          node(2, 'buildr/heading', { text: s('Hello'), level: s(1) }),
          node(3, 'buildr/text', { text: s('World') }),
        ],
        { [ID(1)]: [ID(2), ID(3)] },
      );
      expect(render(d, options())).toBe(
        '<div class="bc-page b-root"><section class="bc-section b-node000001">' +
          '<h1 class="bc-heading b-node000002">Hello</h1>' +
          '<p class="bc-text b-node000003">World</p></section></div>',
      );
    });

    it('hands every declared slot to the component, empty ones as null', () => {
      const d = doc([node(1, 'buildr/card'), node(2, 'buildr/text', { text: s('body') })], {
        [ID(1)]: [ID(2)],
      });
      expect(render(d, options())).toContain(
        '<article class="bc-card b-node000001"><header></header><div><p class="bc-text b-node000002">body</p></div><footer></footer></article>',
      );
    });

    it('renders named slots', () => {
      const card = node(1, 'buildr/card', {}, { slots: { header: [ID(2)], footer: [ID(3)] } });
      const d = doc(
        [card, node(2, 'buildr/heading'), node(3, 'buildr/text', { text: s('f') })],
        {},
        [ID(1)],
      );
      const out = render(d, options());
      expect(out).toContain('<header><h2 class="bc-heading b-node000002">Heading</h2></header>');
      expect(out).toContain('<footer><p class="bc-text b-node000003">f</p></footer>');
    });

    it('passes the node, env and children to the component', () => {
      const seen: unknown[] = [];
      const d = doc([node(1, 'buildr/section')]);
      const tree = renderTree(d, options({ messages: { hello: 'Hi' } }));
      const walk = (n: ReactNode): void => {
        if (Array.isArray(n)) {
          n.forEach(walk);
          return;
        }
        if (isValidElement(n)) {
          const props = n.props as { node?: unknown; env?: unknown };
          if (props.node !== undefined) seen.push(props);
          walk((n.props as { children?: ReactNode }).children);
        }
      };
      walk(tree);
      expect(seen[0]).toMatchObject({
        node: { id: 'root', type: 'buildr/page' },
        env: { mode: 'production', locale: 'en', messages: { hello: 'Hi' } },
      });
    });
  });

  describe('props', () => {
    it('resolves bindings, expressions, fallbacks and defaults', () => {
      const d = doc([
        node(1, 'buildr/heading', { text: bind('post.title') }),
        node(2, 'buildr/heading', { text: bind('post.missing', { fallback: 'Fallback' }) }),
        node(3, 'buildr/heading', { text: expr('upper(post.title)') }),
        node(4, 'buildr/heading'),
      ]);
      const out = render(d, options({ context: dataContext({ post: { title: 'Title' } }) }));
      expect(out).toContain('>Title</h2>');
      expect(out).toContain('>Fallback</h2>');
      expect(out).toContain('>TITLE</h2>');
      expect(out).toContain('>Heading</h2>');
    });

    it('uses the translation for the active locale, and falls back without one', () => {
      const d = doc([node(1, 'buildr/text', { text: s('Hello', { l10n: { pl: 'Cześć' } }) })]);
      expect(render(d, options({ context: dataContext({}, 'pl') }))).toContain('>Cześć</p>');
      expect(render(d, options({ context: dataContext({}, 'en') }))).toContain('>Hello</p>');
    });

    it('collects diagnostics instead of throwing', () => {
      const d = doc([node(1, 'buildr/heading', { level: s(99) })]);
      const diagnostics: Diagnostic[] = [];
      expect(() => render(d, options({ diagnostics }))).not.toThrow();
      expect(diagnostics.map((x) => x.code)).toContain('prop.invalid-value');
      expect(diagnostics[0]?.details).toMatchObject({ nodeId: ID(1) });
    });
  });

  describe('visibleIf', () => {
    const hidden = (visibleIf: unknown): PageNode =>
      node(1, 'buildr/text', { text: s('secret') }, { visibleIf });

    it('renders nothing for a falsy condition and the node for a truthy one', () => {
      const context = dataContext({ post: { published: false, draft: true } });
      expect(render(doc([hidden(bind('post.published'))]), options({ context }))).not.toContain(
        'secret',
      );
      expect(render(doc([hidden(bind('post.draft'))]), options({ context }))).toContain('secret');
      expect(
        render(doc([hidden(expr('post.draft && !post.published'))]), options({ context })),
      ).toContain('secret');
    });

    it('hides the node when data is missing (fail closed)', () => {
      expect(render(doc([hidden(bind('post.nope'))]), options())).not.toContain('secret');
    });
  });

  describe('unknown components', () => {
    const d = doc([node(1, 'acme/mystery'), node(2, 'buildr/text', { text: s('after') })]);

    it('renders nothing in production and logs', () => {
      const diagnostics: Diagnostic[] = [];
      const out = render(d, options({ diagnostics }));
      expect(out).toBe(
        '<div class="bc-page b-root"><p class="bc-text b-node000002">after</p></div>',
      );
      expect(diagnostics).toMatchObject([
        { code: 'render.unknown-component', details: { nodeId: ID(1), type: 'acme/mystery' } },
      ]);
    });

    it('shows the placeholder the canvas asks for', () => {
      const instrument: CanvasInstrumentation = {
        unknownComponent: (n) => <em>missing {n.type}</em>,
      };
      expect(render(d, options({ instrument }))).toContain('<em>missing acme/mystery</em>');
    });
  });

  describe('root attributes', () => {
    it('sets the anchor as the id', () => {
      const d = doc([node(1, 'buildr/section', {}, { anchor: 'pricing' })]);
      expect(render(d, options())).toContain(
        '<section class="bc-section b-node000001" id="pricing">',
      );
    });

    it('names a component after its namespace unless it is buildr', () => {
      const html2 = render(doc([node(1, 'acme/probe')]), options());
      expect(html2).toContain('class="bc-acme-probe b-node000001"');
    });

    it('adds data-bid through the instrumentation', () => {
      const d = doc([node(1, 'buildr/text', { text: s('x') })]);
      expect(render(d, options({ instrument: withNodeIds }))).toContain(
        '<p class="bc-text b-node000001" data-bid="node000001">x</p>',
      );
    });
  });

  describe('instrumentation', () => {
    it('wraps every rendered node and fills empty slots', () => {
      const instrument: CanvasInstrumentation = {
        NodeView: ({ node: n, children }) => <span data-view={n.id}>{children}</span>,
        emptySlot: (n, slot) => <i>{`drop into ${n.id}/${slot}`}</i>,
      };
      const d = doc([node(1, 'buildr/card')], {}, [ID(1)]);
      const out = render(d, options({ instrument }));
      expect(out).toContain('<span data-view="root"><div class="bc-page b-root">');
      expect(out).toContain('<span data-view="node000001"><article');
      expect(out).toContain('<header><i>drop into node000001/header</i></header>');
    });

    it('changes nothing about the output without it', () => {
      const d = doc([node(1, 'buildr/text', { text: s('x') })]);
      const plain = render(d, options());
      const instrumented = render(d, options({ instrument: {} }));
      expect(instrumented).toBe(plain);
    });
  });

  describe('media', () => {
    const image = node(1, 'buildr/image', {
      image: s({ source: 'payload', collection: 'media', id: 'm1' }),
    });
    const withSnapshot = node(1, 'buildr/image', {
      image: s({
        source: 'payload',
        collection: 'media',
        id: 'm2',
        snapshot: { url: '/snap.png', alt: 'snap', mimeType: 'image/png' },
      }),
    });

    it('hands the component the prepared asset, through the platform image', () => {
      const data = {
        ...emptyData,
        media: { m1: { id: 'm1', url: '/a.png', alt: 'An asset', mimeType: 'image/png' } },
      };
      expect(render(doc([image]), options({ data }))).toContain(
        '<img src="/a.png" alt="An asset" data-platform="image" class="bc-image b-node000001"/>',
      );
    });

    it('falls back to the snapshot stored with the reference, with a warning', () => {
      const diagnostics: Diagnostic[] = [];
      const out = render(doc([withSnapshot]), options({ diagnostics }));
      expect(out).toContain('src="/snap.png"');
      expect(diagnostics.map((x) => x.code)).toContain('render.media-snapshot');
    });

    it('reports media that was never prepared and renders without it', () => {
      const diagnostics: Diagnostic[] = [];
      const out = render(doc([image]), options({ diagnostics }));
      expect(out).not.toContain('<img');
      expect(diagnostics.map((x) => x.code)).toContain('render.media-missing');
    });
  });

  describe("runtime: 'client'", () => {
    const d = doc([node(1, 'acme/probe', { label: s('hi') })]);

    it('receives serializable props and no platform', () => {
      const keys = /data-keys="([^"]*)"/.exec(render(d, options()))?.[1]?.split(',');
      expect(keys).toEqual(['env', 'node', 'props', 'root', 'slots']);
      expect(keys).not.toContain('platform');
    });

    it('is checked for serializability in development', () => {
      const bad: CanvasInstrumentation = {
        rootAttributes: () => ({ onClick: () => {} }) as never,
      };
      expect(() => renderTree(d, options({ instrument: bad, devChecks: true }))).toThrow(
        /not serializable/,
      );
      expect(() => renderTree(d, options({ instrument: bad, devChecks: false }))).not.toThrow();
    });

    it('is the registered definition that the tree uses', () => {
      expect(registry.get('acme/probe')).toBe(ClientProbe);
    });
  });

  describe('robustness', () => {
    it('stops at a node that contains itself', () => {
      const looped = doc([node(1, 'buildr/section')], { [ID(1)]: [ID(1)] }, [ID(1)]);
      const diagnostics: Diagnostic[] = [];
      expect(() => render(looped, options({ diagnostics }))).not.toThrow();
      expect(diagnostics.map((x) => x.code)).toContain('render.cycle');
    });

    it('skips a child that does not exist', () => {
      const d = doc([node(1, 'buildr/section')], { [ID(1)]: ['ghost00000'] });
      expect(render(d, options())).toContain('<section class="bc-section b-node000001"></section>');
    });

    it('renders the same document to the same markup every time', () => {
      const d = doc([node(1, 'buildr/heading', { text: bind('post.title') })]);
      const o = options({ context: dataContext({ post: { title: 'T' } }) });
      expect(render(d, o)).toBe(render(d, o));
    });

    it('does not change the document', () => {
      const d = doc([node(1, 'buildr/heading', { text: bind('post.title') })]);
      const before = JSON.stringify(d);
      render(d, options({ context: dataContext({ post: { title: 'T' } }) }));
      expect(JSON.stringify(d)).toBe(before);
    });
  });

  describe('the shared render path uses no hooks or context', () => {
    /** Calls every function component directly — there is no React dispatcher, so any hook would throw. */
    function expand(n: ReactNode): unknown {
      if (Array.isArray(n)) return n.map(expand);
      if (!isValidElement(n)) return n;
      const props = n.props as { children?: ReactNode };
      if (typeof n.type === 'function') {
        return expand((n.type as (p: unknown) => ReactNode)(n.props));
      }
      if ((n.type as unknown) === Fragment) return expand(props.children);
      return { type: n.type, children: expand(props.children) };
    }

    it('renders a whole tree without a React dispatcher', () => {
      const d = doc(
        [
          node(1, 'buildr/section'),
          node(2, 'buildr/heading', { text: bind('post.title') }),
          node(3, 'buildr/card'),
          node(4, 'buildr/link', { label: s('go'), href: s('/x') }),
        ],
        { [ID(1)]: [ID(2), ID(3), ID(4)] },
      );
      const instrument: CanvasInstrumentation = {
        ...withNodeIds,
        NodeView: ({ children }) => <>{children}</>,
      };
      const tree = renderTree(
        d,
        options({ context: dataContext({ post: { title: 'T' } }), instrument }),
      );
      expect(() => expand(tree)).not.toThrow();
    });

    it('has no hook or context calls in its source', () => {
      const dir = new URL('.', import.meta.url);
      const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.includes('.test'));
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const source = readFileSync(new URL(file, dir), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        expect(source, file).not.toMatch(/\buse[A-Z]\w*\s*\(/);
        expect(source, file).not.toMatch(/\b(createContext|useContext|use)\s*\(/);
        expect(source, file).not.toMatch(/dangerouslySetInnerHTML/);
      }
    });
  });
});
