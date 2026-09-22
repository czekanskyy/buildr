import { describe, expect, expectTypeOf, it } from 'vitest';
import type { JsonValue } from '../json/json-value.ts';
import { type PropDef, p, type ResolvedProps } from './index.ts';

describe('p.*', () => {
  it('text: applies defaults', () => {
    expect(p.text()).toEqual({
      kind: 'text',
      localizable: true,
      accepts: ['string', 'number', 'date', 'enum', 'url'],
      default: '',
    });
  });

  it('text: carries through provided metadata', () => {
    const def = p.text({
      label: 'Text',
      default: 'Heading',
      required: true,
      bindable: true,
      maxLength: 300,
    });
    expect(def).toEqual({
      kind: 'text',
      label: 'Text',
      bindable: true,
      required: true,
      localizable: true,
      accepts: ['string', 'number', 'date', 'enum', 'url'],
      default: 'Heading',
      maxLength: 300,
    });
  });

  it('localizable defaults per docs/i18n.md and can be overridden per prop', () => {
    expect(p.text().localizable).toBe(true);
    expect(p.number().localizable).toBe(false);
    expect(p.boolean().localizable).toBe(false);
    expect(p.select({ options: ['a', 'b'] }).localizable).toBe(false);
    expect(p.icon().localizable).toBe(false);
    expect(p.media().localizable).toBe(false);
    expect(p.text({ localizable: false }).localizable).toBe(false);
    expect(p.number({ localizable: true }).localizable).toBe(true);
  });

  it('select: falls back to the first option as the default', () => {
    expect(p.select({ options: [1, 2, 3] }).default).toBe(1);
    expect(p.select({ options: [1, 2, 3], default: 3 }).default).toBe(3);
  });

  it('object: composes its default from each field default', () => {
    const def = p.object({ label: p.text({ default: 'a' }), value: p.number({ default: 3 }) });
    expect(def.default).toEqual({ label: 'a', value: 3 });
  });

  it('list: defaults to an empty array', () => {
    expect(p.list(p.text()).default).toEqual([]);
  });

  it('media/richText/listSource default to null pending a later phase', () => {
    expect(p.media().default).toBeNull();
    expect(p.richText().default).toBeNull();
    expect(p.listSource().default).toBeNull();
  });

  const allKinds: [string, PropDef][] = [
    ['text', p.text({ maxLength: 10 })],
    ['textarea', p.textarea()],
    ['richText', p.richText()],
    ['number', p.number({ min: 1, max: 12, step: 1 })],
    ['boolean', p.boolean()],
    ['select', p.select({ options: [1, 2, 3] })],
    ['link', p.link()],
    ['media', p.media({ accept: ['image'] })],
    ['icon', p.icon()],
    ['list', p.list(p.text(), { max: 50 })],
    ['object', p.object({ label: p.text(), value: p.text() })],
    ['listSource', p.listSource({ accept: ['posts', 'products'] })],
  ];

  for (const [name, def] of allKinds) {
    it(`${name}: round-trips through JSON`, () => {
      expect(JSON.parse(JSON.stringify(def))).toEqual(def);
    });
  }

  it('matches the docs/component-registry.md#props-dsl-p example verbatim', () => {
    const props = {
      text: p.text({
        label: 'Text',
        default: 'Heading',
        required: true,
        bindable: true,
        maxLength: 300,
      }),
      level: p.select({ label: 'Level', options: [1, 2, 3, 4, 5, 6], default: 2 }),
      href: p.link({ label: 'Link', bindable: true }),
      image: p.media({ label: 'Image', accept: ['image'], bindable: true }),
      body: p.richText({ label: 'Content', bindable: true }),
      count: p.number({ min: 1, max: 12, step: 1, default: 3 }),
      open: p.boolean({ default: false }),
      icon: p.icon(),
      items: p.list(p.object({ label: p.text(), value: p.text() }), { max: 50 }),
      source: p.listSource({ accept: ['posts', 'products'] }),
      ariaLabel: p.text({ label: 'Accessible name', group: 'a11y' }),
    };

    for (const def of Object.values(props)) {
      expect(JSON.parse(JSON.stringify(def))).toEqual(def);
    }
    expect(props.level.default).toBe(2);
    expect(props.items.default).toEqual([]);
  });
});

describe('ResolvedProps', () => {
  it('infers each MVP kind', () => {
    const props = {
      text: p.text(),
      textarea: p.textarea(),
      richText: p.richText(),
      count: p.number(),
      flag: p.boolean(),
      level: p.select({ options: [1, 2, 3] }),
      href: p.link(),
      image: p.media(),
      icon: p.icon(),
      source: p.listSource(),
    };

    expectTypeOf<ResolvedProps<typeof props>>().toEqualTypeOf<{
      text: string;
      textarea: string;
      richText: JsonValue;
      count: number;
      flag: boolean;
      level: string | number;
      href: string;
      image: JsonValue;
      icon: string;
      source: JsonValue;
    }>();
  });

  it('resolves list/object nesting two levels deep', () => {
    const props = {
      items: p.list(p.object({ label: p.text(), value: p.text() })),
    };

    expectTypeOf<ResolvedProps<typeof props>>().toEqualTypeOf<{
      items: { label: string; value: string }[];
    }>();
  });

  it('widens beyond two levels of list/object nesting', () => {
    const props = {
      items: p.list(p.list(p.object({ a: p.text() }))),
    };

    expectTypeOf<ResolvedProps<typeof props>>().toEqualTypeOf<{
      items: Record<string, unknown>[][];
    }>();
  });
});
