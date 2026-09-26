import { s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Form } from '../form/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Checkbox } from './definition.ts';
import { checkboxFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Form, Checkbox] });
const checkbox = (props: Record<string, unknown>) =>
  pageWith({
    type: 'buildr/form',
    children: [{ type: 'buildr/checkbox', props: props as never }] as never,
  });
const control = (html: string) => /<input [^>]*type="checkbox"[^>]*>/.exec(html)?.[0] ?? '';

describe('buildr/checkbox', () => {
  it('is a checkbox with its label after it, tied to it', async () => {
    const { html } = await render(registry, checkbox({ label: s('I agree'), name: s('agree') }));
    const id = /<label for="(f-[^"]+)"/.exec(html)?.[1];
    expect(html).toMatch(/<div class="bc-checkbox b-[^"]+" data-layout="inline">/);
    expect(control(html)).toContain(`id="${id}"`);
    expect(control(html)).toContain('name="agree"');
    expect(html.indexOf('type="checkbox"')).toBeLessThan(html.indexOf('<label'));
  });

  it('can be required, and start ticked', async () => {
    const { html } = await render(
      registry,
      checkbox({ name: s('a'), required: s(true), defaultChecked: s(true) }),
    );
    expect(control(html)).toContain('required=""');
    expect(control(html)).toContain('checked=""');
    expect(control((await render(registry, checkbox({ name: s('a') }))).html)).not.toContain(
      'checked',
    );
  });

  it('always shows its label: there is no way to hide it', async () => {
    expect(Checkbox.meta.props).not.toHaveProperty('hideLabel');
    const { html } = await render(registry, checkbox({ label: s('Yes'), name: s('a') }));
    expect(html).not.toContain('bc-visually-hidden');
  });

  it('ties a hint to the control', async () => {
    const { html } = await render(registry, checkbox({ name: s('a'), hint: s('Anytime') }));
    expect(control(html)).toContain('aria-describedby=');
  });

  it('is a boolean form control, only valid inside a form', () => {
    expect(Checkbox.meta.formField).toEqual({
      valueType: 'boolean',
      nameProp: 'name',
      requiredProp: 'required',
    });
    expect(Checkbox.meta.parents?.requireAncestor).toEqual(['buildr/form']);
  });

  it('has valid, accessible fixtures and serializable metadata', () => {
    for (const f of checkboxFixtures) expect(problemsOf(registry, f)).toEqual([]);
    expect(JSON.parse(JSON.stringify(Checkbox.meta))).toEqual(Checkbox.meta);
  });
});
