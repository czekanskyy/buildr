import { runA11y, s } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { Form } from '../form/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { INPUT_TYPES, Input } from './definition.ts';
import { inputFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Form, Input] });
const input = (props: Record<string, unknown>) =>
  pageWith({
    type: 'buildr/form',
    children: [{ type: 'buildr/input', props: props as never }] as never,
  });
const control = (html: string) =>
  /<input [^>]*class="bc-field__control"[^>]*>/.exec(html)?.[0] ?? '';

describe('buildr/input', () => {
  it('is a labelled input in one wrapper, the label tied to the control', async () => {
    const { html } = await render(registry, input({ label: s('Email'), name: s('email') }));
    const id = /<label for="(f-[^"]+)"/.exec(html)?.[1];
    expect(id).toBeDefined();
    expect(html).toMatch(/<div class="bc-input b-[^"]+" data-layout="stacked">/);
    expect(html).toContain(`<label for="${id}" class="bc-field__label">Email</label>`);
    expect(control(html)).toContain(`id="${id}"`);
    expect(control(html)).toContain('name="email"');
    expect(control(html)).toContain('type="text"');
  });

  it.each(INPUT_TYPES)('supports the %s type', async (type) => {
    const { html } = await render(registry, input({ name: s('x'), type: s(type) }));
    expect(control(html)).toContain(`type="${type}"`);
  });

  it('falls back to text for a type it does not know, never passing it through', async () => {
    const { html } = await render(
      registry,
      input({ name: s('x'), type: s('password" onfocus="x') }),
    );
    expect(control(html)).toContain('type="text"');
    expect(html).not.toContain('onfocus');
  });

  it('marks a required field to everyone: the attribute, and a star hidden from screen readers', async () => {
    const { html } = await render(registry, input({ name: s('x'), required: s(true) }));
    expect(control(html)).toContain('required=""');
    expect(html).toContain('<span class="bc-field__required" aria-hidden="true"> *</span>');
    const plain = await render(registry, input({ name: s('x') }));
    expect(control(plain.html)).not.toContain('required');
    expect(plain.html).not.toContain('bc-field__required');
  });

  it('limits the length, and ignores a limit that makes no sense', async () => {
    expect(
      control((await render(registry, input({ name: s('x'), maxLength: s(50) }))).html),
    ).toContain('maxLength="50"');
    for (const bad of [0, -1, 1.5]) {
      const { html } = await render(registry, input({ name: s('x'), maxLength: s(bad) }));
      expect(control(html), String(bad)).not.toContain('maxLength');
    }
  });

  it('ties a hint to the control with aria-describedby', async () => {
    const { html } = await render(registry, input({ name: s('x'), hint: s('As on your ID') }));
    const hint = /<p id="([^"]+)" class="bc-field__hint">As on your ID<\/p>/.exec(html)?.[1];
    expect(hint).toBeDefined();
    expect(control(html)).toContain(`aria-describedby="${hint}"`);
    expect(control((await render(registry, input({ name: s('x') }))).html)).not.toContain(
      'aria-describedby',
    );
  });

  it('keeps a hidden label for assistive technology', async () => {
    const { html } = await render(
      registry,
      input({ label: s('Search'), name: s('q'), hideLabel: s(true) }),
    );
    expect(html).toMatch(/<label for="f-[^"]+" class="bc-visually-hidden">Search<\/label>/);
  });

  it('has a place for an error, empty and hidden until the server reports one', async () => {
    const { html } = await render(registry, input({ name: s('x') }));
    expect(html).toMatch(
      /<p id="f-[^"]+-error" class="bc-field__error" role="alert" hidden=""><\/p>/,
    );
  });

  it('escapes the label, hint and placeholder', async () => {
    const evil = '"><script>alert(1)</script>';
    const { html } = await render(
      registry,
      input({ label: s(evil), name: s('x'), hint: s(evil), placeholder: s(evil) }),
    );
    expect(html).not.toContain('<script>');
  });

  it('gives two fields different ids', async () => {
    const doc = pageWith({
      type: 'buildr/form',
      children: [
        { type: 'buildr/input', props: { name: s('a') } },
        { type: 'buildr/input', props: { name: s('b') } },
      ] as never,
    });
    const { html } = await render(registry, doc);
    const ids = [...html.matchAll(/<label for="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
  });

  it('is named: the form-label rule wants a label', () => {
    const rules = (props: Record<string, unknown>) =>
      runA11y(input(props), registry.meta).map((i) => i.ruleId);
    expect(rules({ name: s('x'), label: s('') })).toContain('form-label');
    expect(rules({ name: s('x'), label: s('Name') })).not.toContain('form-label');
  });

  it('is only valid inside a form, and is a form control with a schema', () => {
    expect(Input.meta.parents?.requireAncestor).toEqual(['buildr/form']);
    expect(Input.meta.contentCategories).toContain('form-control');
    expect(Input.meta.formField).toEqual({
      valueType: 'string',
      nameProp: 'name',
      requiredProp: 'required',
      maxLengthProp: 'maxLength',
    });
    expect(Input.meta.props['name']?.bindable).toBe(false);
  });

  it('has valid, accessible fixtures and serializable metadata', () => {
    for (const f of inputFixtures) expect(problemsOf(registry, f)).toEqual([]);
    expect(JSON.parse(JSON.stringify(Input.meta))).toEqual(Input.meta);
  });
});
