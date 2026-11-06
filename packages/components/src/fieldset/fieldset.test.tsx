// @vitest-environment jsdom
import { defaultTheme, s, validateDocument } from '@next-buildr/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { createDefaultRegistry } from '../registry.ts';
import { pageWith, problemsOf, render } from '../test-kit.tsx';
import { Fieldset } from './definition.ts';
import { fieldsetFixtures } from './fixtures.ts';

const registry = createDefaultRegistry();
describe('buildr/fieldset', () => {
  it('renders SSR and passes axe', async () => {
    const { html } = await render(registry, pageWith(fieldsetFixtures[0]?.tree as never));
    expect(
      html
        .match(/<fieldset[\s\S]*?<\/fieldset>/)?.[0]
        .replace(/\b[bf]-[A-Za-z0-9_-]{10}\b/g, 'NODE'),
    ).toMatchInlineSnapshot(
      `"<fieldset class="bc-fieldset NODE"><legend>Contact details</legend><div class="bc-input NODE" data-layout="stacked"><label for="NODE" class="bc-field__label">Email</label><input id="NODE" class="bc-field__control" type="text" name="email"/><p id="NODE-error" class="bc-field__error" role="alert" hidden=""></p></div></fieldset>"`,
    );
    const container = document.createElement('main');
    container.innerHTML = html;
    expect((await axe(container)).violations).toEqual([]);
  });
  it('spreads the root and disables its controls natively', () => {
    const html = renderToStaticMarkup(
      createElement(
        Fieldset.render as never,
        {
          props: { legend: 'Details', disabled: true },
          root: { className: 'bc-fieldset custom', 'data-test': 'root', id: 'group' },
        },
        createElement('input'),
      ),
    );
    expect(html).toBe(
      '<fieldset class="bc-fieldset custom" data-test="root" id="group" disabled=""><legend>Details</legend><input/></fieldset>',
    );
  });
  it.each(['', ' \t\n '])('omits a blank legend %j while preserving children', (legend) => {
    const html = renderToStaticMarkup(
      createElement(
        Fieldset.render as never,
        { props: { legend, disabled: false }, root: { className: 'bc-fieldset' } },
        createElement('input'),
      ),
    );
    expect(html).toMatchInlineSnapshot(`"<fieldset class="bc-fieldset"><input/></fieldset>"`);
  });
  it.each(['', ' \t\n '])('omits a bound blank legend %j', async (title) => {
    const { html } = await render(
      registry,
      pageWith({
        type: 'buildr/form',
        children: [
          {
            type: 'buildr/fieldset',
            props: { legend: { kind: 'binding', path: 'group.title' } } as never,
          },
        ],
      }),
      undefined,
      { group: { title } },
    );
    expect(html).toContain('<fieldset');
    expect(html).not.toContain('<legend');
  });
  it('binds legend and disabled', async () => {
    const { html } = await render(
      registry,
      pageWith({
        type: 'buildr/form',
        children: [
          {
            type: 'buildr/fieldset',
            props: {
              legend: { kind: 'binding', path: 'group.title' },
              disabled: { kind: 'binding', path: 'group.disabled' },
            } as never,
          },
        ],
      }),
      undefined,
      { group: { title: 'Bound legend', disabled: true } },
    );
    expect(html).toContain('<legend>Bound legend</legend>');
    expect(html).toContain('disabled=""');
  });
  it('validates props and requires a form ancestor', () => {
    const issues = (tree: Parameters<typeof pageWith>[0]) =>
      validateDocument(pageWith(tree), { registry: registry.meta, theme: defaultTheme }).issues;
    expect(issues({ type: 'buildr/fieldset' }).length).toBeGreaterThan(0);
    expect(
      issues({
        type: 'buildr/form',
        children: [{ type: 'buildr/fieldset', props: { disabled: s('wrong') } as never }],
      }).length,
    ).toBeGreaterThan(0);
    for (const fixture of fieldsetFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
    expect(Fieldset.meta.props['legend']?.localizable).toBe(true);
    expect(JSON.parse(JSON.stringify(Fieldset.meta))).toEqual(Fieldset.meta);
  });
});
