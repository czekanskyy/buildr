import { deriveFormSchema, s } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { Form } from '../form/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Select } from './definition.ts';
import { selectFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Form, Select] });
const select = (props: Record<string, unknown>) =>
  pageWith({
    type: 'buildr/form',
    children: [{ type: 'buildr/select', props: props as never }] as never,
  });
const options = (...values: string[]) =>
  s(values.map((value) => ({ label: value.toUpperCase(), value }))) as never;

describe('buildr/select', () => {
  it('is a labelled select with its options', async () => {
    const { html } = await render(
      registry,
      select({ label: s('Topic'), name: s('topic'), options: options('a', 'b') }),
    );
    const id = /<label for="(f-[^"]+)"/.exec(html)?.[1];
    expect(html).toMatch(/<div class="bc-select b-[^"]+" data-layout="stacked">/);
    expect(html).toMatch(new RegExp(`<select [^>]*id="${id}"`));
    expect(html).toContain('<option value="a">A</option><option value="b">B</option>');
  });

  it('shows a placeholder as an empty first choice', async () => {
    const { html } = await render(
      registry,
      select({ name: s('t'), placeholder: s('Choose'), options: options('a') }),
    );
    expect(html).toMatch(/<option value=""[^>]*>Choose<\/option><option value="a">/);
  });

  it('makes the empty choice unselectable when the field is required', async () => {
    const { html } = await render(
      registry,
      select({ name: s('t'), required: s(true), placeholder: s('Choose'), options: options('a') }),
    );
    expect(html).toMatch(/<option value="" disabled=""[^>]*>Choose<\/option>/);
    expect(html).toMatch(/<select [^>]*required=""/);
  });

  it('shows no empty choice when there is no placeholder and the field is optional', async () => {
    const { html } = await render(registry, select({ name: s('t'), options: options('a') }));
    expect(html).not.toContain('<option value="">');
  });

  it('skips options without a value, and uses the value as a label when there is none', async () => {
    const { html } = await render(
      registry,
      select({
        name: s('t'),
        options: s([
          { label: 'Gone', value: '' },
          { label: '', value: 'x' },
          { label: 'Y', value: 'y' },
        ]) as never,
      }),
    );
    expect(html).not.toContain('Gone');
    expect(html).toContain('<option value="x">x</option>');
    expect(html).toContain('<option value="y">Y</option>');
  });

  it('escapes labels and values', async () => {
    const { html } = await render(
      registry,
      select({
        name: s('t'),
        options: s([{ label: '<script>alert(1)</script>', value: '"><img src=x>' }]) as never,
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
  });

  it('gives the server exactly the values shown', () => {
    const doc = select({ name: s('topic'), options: options('a', 'b', 'a') });
    const formId = Object.values(doc.nodes).find((n) => n.type === 'buildr/form')?.id ?? '';
    const { schema } = deriveFormSchema(doc, registry.meta, formId);
    expect(schema.fields[0]).toMatchObject({
      name: 'topic',
      valueType: 'enum',
      options: ['a', 'b'],
    });
  });

  it('has an optionsProp in its schema metadata and is only valid inside a form', () => {
    expect(Select.meta.formField).toEqual({
      valueType: 'enum',
      nameProp: 'name',
      requiredProp: 'required',
      optionsProp: 'options',
    });
    expect(Select.meta.parents?.requireAncestor).toEqual(['buildr/form']);
  });

  it('has valid, accessible fixtures and serializable metadata', () => {
    for (const f of selectFixtures) expect(problemsOf(registry, f)).toEqual([]);
    expect(JSON.parse(JSON.stringify(Select.meta))).toEqual(Select.meta);
  });
});
