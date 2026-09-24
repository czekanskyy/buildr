import { describe, expect, it } from 'vitest';
import type { BuilderDocument, NodeId, PageNode, Value } from '../document/types.ts';
import type { ComponentMeta, FormFieldMeta } from '../registry/meta.ts';
import { createRegistryMeta } from '../registry/registry.ts';
import { p } from '../schema/p.ts';
import { bind, s } from '../values/helpers.ts';
import { deriveFormSchema, MAX_FORM_FIELDS } from './derive-form-schema.ts';

function component(type: string, overrides: Partial<ComponentMeta> = {}): ComponentMeta {
  return {
    type,
    version: 1,
    label: type,
    category: 'forms',
    props: {},
    contentCategories: ['flow'],
    styles: { groups: [] },
    runtime: 'shared',
    ...overrides,
  };
}

const field = (formField: FormFieldMeta): Partial<ComponentMeta> => ({
  contentCategories: ['flow', 'form-control'],
  props: {
    name: p.text({ bindable: true }),
    required: p.boolean(),
    maxLength: p.number(),
    options: p.list(p.object({ label: p.text(), value: p.text() })),
  },
  formField,
});

const registry = createRegistryMeta({
  components: [
    component('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
    component('buildr/form', { slots: { default: {} } }),
    component('buildr/stack', { slots: { default: {} } }),
    component(
      'buildr/input',
      field({
        valueType: 'string',
        nameProp: 'name',
        requiredProp: 'required',
        maxLengthProp: 'maxLength',
      }),
    ),
    component(
      'buildr/checkbox',
      field({ valueType: 'boolean', nameProp: 'name', requiredProp: 'required' }),
    ),
    component(
      'buildr/select',
      field({
        valueType: 'enum',
        nameProp: 'name',
        requiredProp: 'required',
        optionsProp: 'options',
      }),
    ),
    // A control the form knows nothing about: it takes part through its metadata alone.
    component('acme/rating', field({ valueType: 'number', nameProp: 'name' })),
    component('buildr/text'),
  ],
});

interface Spec {
  readonly id: string;
  readonly type: string;
  readonly props?: Record<string, Value>;
  readonly children?: readonly string[];
}

function build(specs: readonly Spec[]): BuilderDocument {
  const nodes: Record<NodeId, PageNode> = {
    root: {
      id: 'root',
      type: 'buildr/page',
      slots: { default: specs.filter((x) => x.id === 'form').map((x) => x.id) },
    },
  };
  for (const spec of specs) {
    nodes[spec.id] = {
      id: spec.id,
      type: spec.type,
      ...(spec.props !== undefined ? { props: spec.props } : {}),
      ...(spec.children !== undefined ? { slots: { default: [...spec.children] } } : {}),
    };
  }
  return { schemaVersion: 1, root: 'root', nodes, components: {} };
}

const named = (name: string, extra: Record<string, Value> = {}) => ({ name: s(name), ...extra });
const derive = (specs: readonly Spec[]) => deriveFormSchema(build(specs), registry, 'form');
const codes = (r: ReturnType<typeof derive>) => r.diagnostics.map((d) => d.code);

describe('deriveFormSchema', () => {
  it('reads every field of the form off its metadata', () => {
    const { schema, diagnostics } = derive([
      { id: 'form', type: 'buildr/form', children: ['a', 'stack'] },
      {
        id: 'a',
        type: 'buildr/input',
        props: named('email', { required: s(true), maxLength: s(120) }),
      },
      { id: 'stack', type: 'buildr/stack', children: ['b', 'c', 'd'] },
      { id: 'b', type: 'buildr/checkbox', props: named('agree', { required: s(true) }) },
      {
        id: 'c',
        type: 'buildr/select',
        props: named('topic', {
          options: s([
            { label: 'Sales', value: 'sales' },
            { label: 'Support', value: 'support' },
          ]),
        }),
      },
      { id: 'd', type: 'acme/rating', props: named('stars') },
    ]);
    expect(diagnostics).toEqual([]);
    expect(schema).toEqual({
      formId: 'form',
      fields: [
        { nodeId: 'a', name: 'email', valueType: 'string', required: true, maxLength: 120 },
        { nodeId: 'b', name: 'agree', valueType: 'boolean', required: true },
        {
          nodeId: 'c',
          name: 'topic',
          valueType: 'enum',
          required: false,
          options: ['sales', 'support'],
        },
        { nodeId: 'd', name: 'stars', valueType: 'number', required: false },
      ],
    });
  });

  it('keeps document order, and ignores components without formField metadata', () => {
    const { schema } = derive([
      { id: 'form', type: 'buildr/form', children: ['t', 'x', 'y'] },
      { id: 't', type: 'buildr/text' },
      { id: 'x', type: 'buildr/input', props: named('second') },
      { id: 'y', type: 'buildr/input', props: named('first') },
    ]);
    expect(schema.fields.map((f) => f.name)).toEqual(['second', 'first']);
  });

  it('gives an empty schema for a form with no fields', () => {
    const result = derive([{ id: 'form', type: 'buildr/form' }]);
    expect(result).toEqual({ schema: { formId: 'form', fields: [] }, diagnostics: [] });
  });

  it('reports a node that does not exist', () => {
    const result = deriveFormSchema(build([]), registry, 'nope');
    expect(result.schema.fields).toEqual([]);
    expect(codes(result)).toEqual(['form.not-found']);
  });

  describe('names', () => {
    it.each([
      ['no name at all', undefined],
      ['an empty name', s('')],
      ['a name that is not a string', s(5)],
    ])('leaves out a field with %s', (_n, value) => {
      const props: Record<string, Value> = value === undefined ? {} : { name: value };
      const result = derive([
        { id: 'form', type: 'buildr/form', children: ['a'] },
        { id: 'a', type: 'buildr/input', props },
      ]);
      expect(result.schema.fields).toEqual([]);
      expect(codes(result)).toEqual(['form.name-missing']);
    });

    it('leaves out a field whose name is bound to data', () => {
      const result = derive([
        { id: 'form', type: 'buildr/form', children: ['a'] },
        { id: 'a', type: 'buildr/input', props: { name: bind('user.field') } },
      ]);
      expect(result.schema.fields).toEqual([]);
      expect(codes(result)).toEqual(['form.name-dynamic']);
    });

    it.each([
      '1st',
      'has space',
      'a.b',
      'a[b]',
      '_private',
      '__proto__',
      'név',
      'a'.repeat(65),
      'constructor',
      'toString',
      'hasOwnProperty',
      '<script>',
    ])('leaves out the invalid name %j', (name) => {
      const result = derive([
        { id: 'form', type: 'buildr/form', children: ['a'] },
        { id: 'a', type: 'buildr/input', props: named(name) },
      ]);
      expect(result.schema.fields).toEqual([]);
      expect(codes(result)).toEqual(['form.name-invalid']);
    });

    it.each(['email', 'first-name', 'first_name', 'a', 'A1', 'a'.repeat(64)])(
      'accepts the name %j',
      (name) => {
        const result = derive([
          { id: 'form', type: 'buildr/form', children: ['a'] },
          { id: 'a', type: 'buildr/input', props: named(name) },
        ]);
        expect(result.schema.fields.map((f) => f.name)).toEqual([name]);
      },
    );

    it('keeps the first of two fields with the same name and reports the second', () => {
      const result = derive([
        { id: 'form', type: 'buildr/form', children: ['a', 'b'] },
        { id: 'a', type: 'buildr/input', props: named('email') },
        { id: 'b', type: 'buildr/checkbox', props: named('email') },
      ]);
      expect(result.schema.fields.map((f) => f.nodeId)).toEqual(['a']);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: 'form.name-duplicate',
        severity: 'error',
        details: { nodeId: 'b', prop: 'name' },
        path: ['nodes', 'b', 'props', 'name'],
      });
    });

    it('treats names as case-sensitive, so `Email` and `email` are different fields', () => {
      const result = derive([
        { id: 'form', type: 'buildr/form', children: ['a', 'b'] },
        { id: 'a', type: 'buildr/input', props: named('email') },
        { id: 'b', type: 'buildr/input', props: named('Email') },
      ]);
      expect(result.schema.fields).toHaveLength(2);
    });
  });

  describe('flags and limits', () => {
    it('only takes an explicit true as required', () => {
      const result = derive([
        { id: 'form', type: 'buildr/form', children: ['a', 'b', 'c'] },
        { id: 'a', type: 'buildr/input', props: named('a', { required: s(true) }) },
        { id: 'b', type: 'buildr/input', props: named('b', { required: bind('flags.required') }) },
        { id: 'c', type: 'buildr/input', props: named('c', { required: s('true') }) },
      ]);
      expect(result.schema.fields.map((f) => f.required)).toEqual([true, false, false]);
    });

    it.each([[0], [-3], [1.5], ['10'], [Number.NaN]])('ignores the max length %j', (max) => {
      const result = derive([
        { id: 'form', type: 'buildr/form', children: ['a'] },
        { id: 'a', type: 'buildr/input', props: named('a', { maxLength: s(max) }) },
      ]);
      expect(result.schema.fields[0]).not.toHaveProperty('maxLength');
    });
  });

  describe('choice fields', () => {
    const selectWith = (options?: Value) =>
      derive([
        { id: 'form', type: 'buildr/form', children: ['a'] },
        {
          id: 'a',
          type: 'buildr/select',
          props: { name: s('topic'), ...(options ? { options } : {}) },
        },
      ]);

    it('needs options', () => {
      for (const options of [undefined, s([]), s('nope'), s([{ label: 'x', value: '' }])]) {
        const result = selectWith(options);
        expect(result.schema.fields).toEqual([]);
        expect(codes(result)).toEqual(['form.options-missing']);
      }
    });

    it('cannot have bound options', () => {
      const result = selectWith(bind('site.topics'));
      expect(result.schema.fields).toEqual([]);
      expect(codes(result)).toEqual(['form.options-dynamic']);
    });

    it('accepts plain strings and numbers, drops empty values and repeats', () => {
      const result = selectWith(
        s([
          { label: 'A', value: 'a' },
          'b',
          { label: 'again', value: 'a' },
          3,
          { label: 'none', value: '' },
        ]),
      );
      expect(result.schema.fields[0]?.options).toEqual(['a', 'b', '3']);
    });
  });

  describe('nested forms', () => {
    it('leaves the fields of an inner form to that form', () => {
      const specs: Spec[] = [
        { id: 'form', type: 'buildr/form', children: ['a', 'inner'] },
        { id: 'a', type: 'buildr/input', props: named('outer') },
        { id: 'inner', type: 'buildr/form', children: ['b'] },
        { id: 'b', type: 'buildr/input', props: named('inner') },
      ];
      expect(derive(specs).schema.fields.map((f) => f.name)).toEqual(['outer']);
      const inner = deriveFormSchema(build(specs), registry, 'inner');
      expect(inner.schema.fields.map((f) => f.name)).toEqual(['inner']);
    });
  });

  it('caps the number of fields', () => {
    const ids = Array.from({ length: MAX_FORM_FIELDS + 5 }, (_, i) => `f${i}`);
    const result = derive([
      { id: 'form', type: 'buildr/form', children: ids },
      ...ids.map((id): Spec => ({ id, type: 'buildr/input', props: named(id) })),
    ]);
    expect(result.schema.fields).toHaveLength(MAX_FORM_FIELDS);
    expect(codes(result)).toEqual(['form.too-many-fields']);
  });

  it('does not depend on the fields being in a slot called default, or on node types it does not know', () => {
    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      components: {},
      nodes: {
        root: { id: 'root', type: 'buildr/page', slots: { default: ['form'] } },
        form: { id: 'form', type: 'buildr/form', slots: { side: ['a', 'ghost'] } },
        a: { id: 'a', type: 'buildr/input', props: { name: s('side') } },
        ghost: { id: 'ghost', type: 'unregistered/thing', props: { name: s('ghost') } },
      },
    };
    const result = deriveFormSchema(doc, registry, 'form');
    expect(result.schema.fields.map((f) => f.name)).toEqual(['side']);
  });

  it('returns a schema that is plain JSON', () => {
    const { schema } = derive([
      { id: 'form', type: 'buildr/form', children: ['a'] },
      { id: 'a', type: 'buildr/input', props: named('email', { maxLength: s(10) }) },
    ]);
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });
});
