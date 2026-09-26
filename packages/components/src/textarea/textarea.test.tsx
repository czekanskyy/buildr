import { s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Form } from '../form/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Textarea } from './definition.ts';
import { textareaFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Form, Textarea] });
const textarea = (props: Record<string, unknown>) =>
  pageWith({
    type: 'buildr/form',
    children: [{ type: 'buildr/textarea', props: props as never }] as never,
  });
const control = (html: string) => /<textarea [^>]*>/.exec(html)?.[0] ?? '';

describe('buildr/textarea', () => {
  it('is a labelled textarea in one wrapper', async () => {
    const { html } = await render(registry, textarea({ label: s('Message'), name: s('message') }));
    const id = /<label for="(f-[^"]+)"/.exec(html)?.[1];
    expect(html).toMatch(/<div class="bc-textarea b-[^"]+" data-layout="stacked">/);
    expect(control(html)).toContain(`id="${id}"`);
    expect(control(html)).toContain('name="message"');
    expect(control(html)).toContain('rows="4"');
  });

  it('takes rows within bounds, and a required flag and length limit', async () => {
    const { html } = await render(
      registry,
      textarea({ name: s('m'), rows: s(8), required: s(true), maxLength: s(500) }),
    );
    expect(control(html)).toContain('rows="8"');
    expect(control(html)).toContain('required=""');
    expect(control(html)).toContain('maxLength="500"');
    for (const bad of [0, 1, 99, 2.5]) {
      const out = await render(registry, textarea({ name: s('m'), rows: s(bad) }));
      expect(control(out.html), String(bad)).toMatch(/rows="(4|2|30)"/);
    }
  });

  it('ties a hint to the control and escapes its text', async () => {
    const { html } = await render(
      registry,
      textarea({ name: s('m'), hint: s('<b>x</b>'), placeholder: s('"><script>') }),
    );
    expect(control(html)).toContain('aria-describedby=');
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<script>');
  });

  it('is a form control with a schema, only valid inside a form', () => {
    expect(Textarea.meta.parents?.requireAncestor).toEqual(['buildr/form']);
    expect(Textarea.meta.formField?.maxLengthProp).toBe('maxLength');
  });

  it('has valid, accessible fixtures and serializable metadata', () => {
    for (const f of textareaFixtures) expect(problemsOf(registry, f)).toEqual([]);
    expect(JSON.parse(JSON.stringify(Textarea.meta))).toEqual(Textarea.meta);
  });
});
