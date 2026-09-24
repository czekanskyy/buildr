import {
  type BuilderDocument,
  createRegistryMeta,
  fromManifest,
  migrateComponents,
  p,
  toManifest,
} from '@buildr/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineComponent } from './define-component.ts';
import { createRegistry } from './registry.ts';
import type { ClientComponentProps, Platform } from './types.ts';

const baseMeta = {
  version: 1,
  category: 'content',
  contentCategories: ['flow'],
  styles: { groups: [] },
} as const;

const Heading = defineComponent({
  ...baseMeta,
  type: 'buildr/heading',
  label: 'Heading',
  runtime: 'shared',
  props: {
    text: p.text({ default: 'Heading', bindable: true }),
    level: p.number({ min: 1, max: 6, default: 2 }),
    visible: p.boolean({ default: true }),
  },
  render: ({ props, root }) => {
    expectTypeOf(props.text).toEqualTypeOf<string>();
    expectTypeOf(props.level).toEqualTypeOf<number>();
    expectTypeOf(props.visible).toEqualTypeOf<boolean>();
    return <h2 {...root}>{props.text}</h2>;
  },
});

const Box = defineComponent({
  ...baseMeta,
  type: 'buildr/box',
  label: 'Box',
  runtime: 'shared',
  props: {},
  slots: { default: {} },
  render: ({ root, children }) => <div {...root}>{children}</div>,
});

describe('defineComponent', () => {
  it('splits the serializable metadata from the implementation', () => {
    expect(Heading.meta.type).toBe('buildr/heading');
    expect(Heading.meta).not.toHaveProperty('render');
    expect(Heading.meta).not.toHaveProperty('migrations');
    expect(typeof Heading.render).toBe('function');
    expect(Heading.migrations).toEqual([]);
    // The metadata survives a JSON round trip, which is what the manifest relies on.
    expect(JSON.parse(JSON.stringify(Heading.meta))).toEqual(Heading.meta);
  });

  it('renders through the definition', () => {
    const html = renderToStaticMarkup(
      <Heading.render
        props={{ text: 'Hi', level: 2, visible: true }}
        root={{ className: 'bc-heading b-x', id: 'top' }}
        slots={{}}
        node={{ id: 'x', type: 'buildr/heading' }}
        env={{ mode: 'production', locale: 'en', messages: {} }}
      />,
    );
    expect(html).toBe('<h2 class="bc-heading b-x" id="top">Hi</h2>');
  });

  it('gives a shared component the platform and a client component none', () => {
    defineComponent({
      ...baseMeta,
      type: 'acme/shared',
      label: 'Shared',
      runtime: 'shared',
      props: {},
      render: (props) => {
        expectTypeOf(props.platform).toEqualTypeOf<Platform | undefined>();
        return null;
      },
    });
    defineComponent({
      ...baseMeta,
      type: 'acme/client',
      label: 'Client',
      runtime: 'client',
      props: { open: p.boolean() },
      render: (props) => {
        expectTypeOf(props.props.open).toEqualTypeOf<boolean>();
        // @ts-expect-error a client component receives only serializable values, never the platform
        props.platform;
        expectTypeOf(props).toMatchTypeOf<ClientComponentProps>();
        return null;
      },
    });
  });

  it('throws on invalid metadata, naming the component', () => {
    const define = (overrides: object) => () =>
      defineComponent({
        ...baseMeta,
        type: 'acme/thing',
        label: 'Thing',
        runtime: 'shared',
        props: {},
        render: () => null,
        ...overrides,
      } as never);
    expect(define({ type: 'NotAType' })).toThrow(/defineComponent\("NotAType"\)/);
    expect(define({ version: 0 })).toThrow(/acme\/thing/);
    expect(define({ props: { level: { ...p.number({ min: 1, max: 6 }), default: 99 } } })).toThrow(
      /acme\/thing/,
    );
    expect(define({ render: undefined })).toThrow(/render/);
  });

  describe('migrations', () => {
    const define = (version: number, migrations: Record<number, never>) => () =>
      defineComponent({
        ...baseMeta,
        type: 'acme/thing',
        label: 'Thing',
        version,
        runtime: 'shared',
        props: {},
        render: () => null,
        migrations,
      });
    const step = (() => undefined) as never;

    it('become ordered from -> to steps', () => {
      const def = defineComponent({
        ...baseMeta,
        type: 'acme/thing',
        label: 'Thing',
        version: 3,
        runtime: 'shared',
        props: {},
        render: () => null,
        migrations: { 3: (props) => props, 2: (props) => props },
      });
      expect(def.migrations.map((s) => [s.from, s.to])).toEqual([
        [1, 2],
        [2, 3],
      ]);
    });

    it('may start above version 2 when older documents never existed', () => {
      expect(define(3, { 3: step })().migrations.map((s) => [s.from, s.to])).toEqual([[2, 3]]);
    });

    it.each([
      ['a target above the version', 2, { 3: step }, /version 3/],
      ['the newest step short of the version', 3, { 2: step }, /newest migration/],
      ['a gap', 4, { 2: step, 4: step }, /skip/],
      ['a target below 2', 2, { 1: step, 2: step }, /2 or more/],
    ])('are rejected for %s', (_name, version, migrations, message) => {
      expect(define(version, migrations)).toThrow(message);
    });
  });
});

describe('createRegistry', () => {
  const registry = createRegistry({ components: [Heading, Box] });

  it('passes the metadata through to core unchanged', () => {
    expect(registry.meta.list()).toEqual([Heading.meta, Box.meta]);
    const manifest = toManifest(registry.meta);
    expect(manifest.components['buildr/heading']).toEqual(Heading.meta);
    const direct = toManifest(createRegistryMeta({ components: [Heading.meta, Box.meta] }));
    expect(manifest).toEqual(direct);
    expect(fromManifest(JSON.parse(JSON.stringify(manifest))).ok).toBe(true);
  });

  it('looks up implementations', () => {
    expect(registry.get('buildr/heading')).toBe(Heading);
    expect(registry.has('buildr/box')).toBe(true);
    expect(registry.get('acme/nope')).toBeUndefined();
    expect(registry.list()).toEqual([Heading, Box]);
  });

  it('feeds component migrations', () => {
    const Legacy = defineComponent({
      ...baseMeta,
      type: 'acme/legacy',
      label: 'Legacy',
      version: 2,
      runtime: 'shared',
      props: { size: p.number({ default: 1 }) },
      render: () => null,
      migrations: {
        2: (props) => ({ ...props, size: { kind: 'static', value: 5 } }),
      },
    });
    const reg = createRegistry({ components: [Heading, Legacy] });
    expect(reg.migrations['acme/legacy']).toMatchObject({ currentVersion: 2 });
    expect(reg.migrations['buildr/heading']).toEqual({ currentVersion: 1, steps: [] });

    const doc: BuilderDocument = {
      schemaVersion: 1,
      root: 'root',
      nodes: {
        root: { id: 'root', type: 'buildr/page', slots: { default: ['legacy0001'] } },
        legacy0001: { id: 'legacy0001', type: 'acme/legacy' },
      },
      components: { 'buildr/page': 1, 'acme/legacy': 1 },
    };
    const migrated = migrateComponents(doc, {
      ...reg.migrations,
      'buildr/page': { currentVersion: 1, steps: [] },
    });
    expect(migrated.readOnlyReasons).toEqual([]);
    expect(migrated.doc.components['acme/legacy']).toBe(2);
    expect(migrated.doc.nodes['legacy0001']?.props?.['size']).toEqual({ kind: 'static', value: 5 });
  });

  it('throws on a duplicate type', () => {
    expect(() => createRegistry({ components: [Heading, Heading] })).toThrow(/buildr\/heading/);
  });

  it('extend returns a new registry and leaves the original alone', () => {
    const Extra = defineComponent({
      ...baseMeta,
      type: 'acme/extra',
      label: 'Extra',
      runtime: 'client',
      props: {},
      render: () => null,
    });
    const extended = registry.extend({ components: [Extra] });
    expect(extended.has('acme/extra')).toBe(true);
    expect(extended.meta.has('acme/extra')).toBe(true);
    expect(registry.has('acme/extra')).toBe(false);
    expect(registry.list()).toHaveLength(2);
    expect(() => registry.extend({ components: [Box] })).toThrow(/buildr\/box/);
  });

  it('keeps templates through extend', () => {
    const template = {
      id: 'acme/hero',
      version: 1,
      label: 'Hero',
      category: 'hero',
      lock: 'none' as const,
      tree: { type: 'buildr/box' },
    };
    const withTemplate = createRegistry({ components: [Box], templates: [template] });
    expect(withTemplate.meta.hasTemplate('acme/hero')).toBe(true);
    expect(withTemplate.extend({ components: [Heading] }).meta.hasTemplate('acme/hero')).toBe(true);
  });
});
