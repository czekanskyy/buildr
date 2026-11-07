// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { IFRAME_REFERRER_POLICY, IFRAME_SANDBOX } from '../iframe/props.ts';
import { message } from '../messages/index.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
// biome-ignore lint/suspicious/noShadowRestrictedNames: Tests the named component export.
import { Map } from './definition.ts';
import { mapFixtures } from './fixtures.ts';
import { MAP_SANDBOX } from './props.ts';
import { MapView } from './view.tsx';

const key = 'K'.repeat(39);
function view(
  maps: unknown = { apiKey: key },
  mode = 'production',
  query = 'Paris',
  capabilities = {},
) {
  return renderToStaticMarkup(
    createElement(Map.render as never, {
      props: { query, title: '', zoom: 15, mapType: 'roadmap', aspectRatio: '16:9' },
      root: { className: 'bc-map', id: 'root', 'data-bid': 'x' },
      node: { id: 'x', type: 'buildr/map' },
      slots: {},
      env: { mode, locale: 'pl', messages: {}, capabilities },
      platform: { maps },
    }),
  );
}
it('renders link only without opt-in', () => {
  expect(view(null)).not.toContain('<iframe');
  expect(view({ apiKey: 'bad' })).not.toContain('<button');
  expect(view({ apiKey: key }, 'production', 'Paris', { iframeHosts: [] })).not.toContain(
    '<button',
  );
  expect(view(null)).toContain('target="_blank" rel="noopener noreferrer"');
  expect(view(null)).toContain('id="root" data-bid="x"');
});
it.each([undefined, 'false', 0, null, true])('requires literal false: %s', (clickToLoad) => {
  const html = view({ apiKey: key, clickToLoad });
  expect(html).toContain('<button');
  expect(html).toContain('hidden=""');
  expect(html).not.toContain('<iframe');
});
it('renders exact iframe permissions on opt-out', () => {
  const html = view({ apiKey: key, clickToLoad: false });
  const host = document.createElement('div');
  host.innerHTML = html;
  const frame = host.querySelector('iframe');
  expect(frame?.getAttribute('sandbox')).toBe(MAP_SANDBOX);
  expect(frame?.getAttribute('referrerpolicy')).toBe('strict-origin');
  expect(frame?.getAttribute('loading')).toBe('lazy');
  expect(frame?.getAttribute('title')).toBe('Mapa: Paris');
  expect(frame?.hasAttribute('allow')).toBe(false);
  expect(frame?.hasAttribute('allowfullscreen')).toBe(false);
  expect(host.querySelector('a')?.href).not.toContain(key);
  expect(IFRAME_SANDBOX).toBe('allow-scripts');
  expect(IFRAME_REFERRER_POLICY).toBe('no-referrer');
});
it('never reads maps or exposes a key on canvas', () => {
  for (const maps of [
    { apiKey: key, clickToLoad: false },
    {
      get apiKey(): string {
        throw Error('read');
      },
    },
  ]) {
    const html = view(maps, 'canvas');
    for (const forbidden of [key, 'key=', 'maps/embed', '<iframe'])
      expect(html).not.toContain(forbidden);
    expect(html).toContain('Mapa wczytuje');
  }
});
it('fails closed for invalid queries', () => {
  expect(view(null, 'production', '')).toBe('');
  expect(view(null, 'canvas', '')).toContain('data-embed-invalid');
});
it('keeps metadata compact', () => {
  expect(new TextEncoder().encode(JSON.stringify(Map.meta)).length).toBeLessThan(1400);
  // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket access.
  expect(Map.meta.props['zoom']?.default).toBe(15);
  // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket access.
  expect(Map.meta.props['query']?.bindable).toBe(true);
});
it('passes axe for all render states', async () => {
  for (const html of [
    view(null),
    view(),
    view({ apiKey: key, clickToLoad: false }),
    view(null, 'canvas'),
    view(null, 'canvas', ''),
  ]) {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.replaceChildren(host);
    expect(
      (
        await axe(host, {
          iframes: false,
          rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  }
});

it('has a stable keyless SSR snapshot', () => {
  expect(view(null)).toMatchInlineSnapshot(
    `"<div class="bc-map" id="root" data-bid="x" data-ratio="16:9"><a class="bc-map__link" href="https://www.google.com/maps/search/?api=1&amp;query=Paris" target="_blank" rel="noopener noreferrer">Otwórz w Mapach Google (otwiera się w nowej karcie)</a></div>"`,
  );
});

it('validates fixtures with a local registry and resolves bindable props', async () => {
  const registry = createRegistry({ components: [Page, Map] });
  for (const fixture of mapFixtures.filter((f) => f.id !== 'map-bound'))
    expect(problemsOf(registry, fixture)).toEqual([]);
  const result = await render(
    registry,
    pageWith({
      type: 'buildr/map',
      props: {
        query: { kind: 'binding', path: 'map.query' },
        title: { kind: 'binding', path: 'map.title' },
      } as never,
    }),
    undefined,
    { map: { query: 'Paris', title: 'Office' } },
  );
  expect(result.html).toContain('query=Paris');
  expect(result.diagnostics).toEqual([]);
});

it.each([
  { zoom: { kind: 'static', value: 22 } },
  { mapType: { kind: 'static', value: 'terrain' } },
  { aspectRatio: { kind: 'static', value: '3:2' } },
])('rejects invalid props %j', (props) => {
  const registry = createRegistry({ components: [Page, Map] });
  expect(
    problemsOf(registry, {
      id: 'invalid',
      title: 'Invalid',
      tree: { type: 'buildr/map', props: props as never },
    }).length,
  ).toBeGreaterThan(0);
});
it('does not access the platform maps getter in canvas', () => {
  expect(() =>
    renderToStaticMarkup(
      createElement(Map.render as never, {
        props: { query: 'Paris', title: '', zoom: 15, mapType: 'roadmap', aspectRatio: '16:9' },
        root: { className: 'bc-map' },
        node: { id: 'x', type: 'buildr/map' },
        slots: {},
        env: { mode: 'canvas', locale: 'en', messages: {} },
        platform: {
          get maps() {
            throw Error('provider access');
          },
        },
      }),
    ),
  ).not.toThrow();
});

it('preserves replacement-pattern characters in the fallback title', () => {
  const query = "A$&B$'C";
  const host = document.createElement('div');
  host.innerHTML = view({ apiKey: key, clickToLoad: false }, 'production', query);
  expect(host.querySelector('iframe')?.title).toBe(`Mapa: ${query}`);
});
it('includes the localized new-tab hint in link text', () => {
  const host = document.createElement('div');
  host.innerHTML = view(null);
  expect(host.querySelector('a')?.textContent).toContain(
    message({ locale: 'pl', messages: {} }, 'map.newTab'),
  );
});
it('confines the fixture provider key to the production enhancer src prop', () => {
  const fixture = mapFixtures.find((f) => f.id === 'map-default');
  expect(fixture).toBeDefined();
  const props = Object.fromEntries(
    Object.entries(fixture?.tree.props ?? {}).map(([name, value]) => [
      name,
      (value as { value: unknown }).value,
    ]),
  );
  for (const mode of ['canvas', 'production']) {
    const tree = MapView({
      props: { title: '', zoom: 15, mapType: 'roadmap', aspectRatio: '16:9', ...props },
      root: { className: 'bc-map' },
      node: { id: 'fixture', type: 'buildr/map' },
      slots: {},
      env: { mode, locale: 'en', messages: {} },
      platform: { maps: { apiKey: key } },
    } as never);
    const html = renderToStaticMarkup(tree);
    const host = document.createElement('div');
    host.innerHTML = html;
    expect(host.querySelector('a')?.getAttribute('href')).not.toContain(key);
    for (const el of host.querySelectorAll('*'))
      for (const attr of el.attributes)
        if (attr.name.startsWith('data-')) expect(attr.value).not.toContain(key);
    expect(html).not.toContain(key);
    if (mode === 'production') {
      const enhancer = tree?.props.children[0];
      expect(enhancer.props.src).toContain(`key=${key}&`);
      const { src, ...otherProps } = enhancer.props;
      expect(src).toContain('/maps/embed/v1/place?');
      expect(JSON.stringify(otherProps)).not.toContain(key);
    } else expect(JSON.stringify(tree)).not.toContain(key);
  }
});
