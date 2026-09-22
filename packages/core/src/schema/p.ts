import type { JsonValue } from '../json/json-value.ts';
import type {
  BooleanOptions,
  BooleanPropDef,
  IconOptions,
  IconPropDef,
  LinkOptions,
  LinkPropDef,
  ListOptions,
  ListPropDef,
  ListSourceOptions,
  ListSourcePropDef,
  MediaOptions,
  MediaPropDef,
  NumberOptions,
  NumberPropDef,
  ObjectOptions,
  ObjectPropDef,
  PropDefBase,
  RichTextOptions,
  RichTextPropDef,
  SelectOptions,
  SelectPropDef,
  TextareaOptions,
  TextareaPropDef,
  TextOptions,
  TextPropDef,
} from './kinds/index.ts';
import {
  buildBooleanPropDef,
  buildIconPropDef,
  buildLinkPropDef,
  buildListPropDef,
  buildListSourcePropDef,
  buildMediaPropDef,
  buildNumberPropDef,
  buildObjectPropDef,
  buildRichTextPropDef,
  buildSelectPropDef,
  buildTextareaPropDef,
  buildTextPropDef,
} from './kinds/index.ts';

export type { PropDef } from './kinds/index.ts';

/**
 * The `p.*` props DSL (docs/component-registry.md#props-dsl-p). Every builder returns a fully
 * JSON-serializable `PropDef` — metadata only, never a function — so `ComponentMeta.props` round-
 * trips through the manifest untouched (ADR-003).
 */
export const p = {
  text: (options?: TextOptions): TextPropDef => buildTextPropDef(options),
  textarea: (options?: TextareaOptions): TextareaPropDef => buildTextareaPropDef(options),
  richText: (options?: RichTextOptions): RichTextPropDef => buildRichTextPropDef(options),
  number: (options?: NumberOptions): NumberPropDef => buildNumberPropDef(options),
  boolean: (options?: BooleanOptions): BooleanPropDef => buildBooleanPropDef(options),
  select: (options: SelectOptions): SelectPropDef => buildSelectPropDef(options),
  link: (options?: LinkOptions): LinkPropDef => buildLinkPropDef(options),
  media: (options?: MediaOptions): MediaPropDef => buildMediaPropDef(options),
  icon: (options?: IconOptions): IconPropDef => buildIconPropDef(options),
  list: <Item extends PropDefBase>(of: Item, options?: ListOptions): ListPropDef<Item> =>
    buildListPropDef(of, options),
  object: <Fields extends Record<string, PropDefBase>>(
    fields: Fields,
    options?: ObjectOptions,
  ): ObjectPropDef<Fields> => buildObjectPropDef(fields, options),
  listSource: (options?: ListSourceOptions): ListSourcePropDef => buildListSourcePropDef(options),
} as const;

// A countdown used to cap `list`/`object` nesting inference at two levels (see the PB-012 backlog
// card's Risks) — recursing on an uncapped generic here blows up TS's instantiation depth.
type Prev = [never, 0, 1, 2];

/**
 * The TypeScript value a resolved prop produces — `p.text()` becomes `string`, `p.number()`
 * becomes `number`, and so on (docs/dynamic-bindings.md#type-safety-fallbacks-errors-security-ui).
 * `list`/`object` nesting is only resolved two levels deep; a third level widens to
 * `unknown[]`/`Record<string, unknown>` rather than recursing indefinitely.
 */
export type ResolvedPropValue<
  D extends PropDefBase,
  Depth extends 0 | 1 | 2 = 2,
> = D extends TextPropDef
  ? string
  : D extends TextareaPropDef
    ? string
    : D extends RichTextPropDef
      ? JsonValue
      : D extends NumberPropDef
        ? number
        : D extends BooleanPropDef
          ? boolean
          : D extends SelectPropDef
            ? string | number
            : D extends LinkPropDef
              ? string
              : D extends MediaPropDef
                ? JsonValue
                : D extends IconPropDef
                  ? string
                  : D extends ListSourcePropDef
                    ? JsonValue
                    : D extends ListPropDef<infer Item>
                      ? Depth extends 0
                        ? unknown[]
                        : Item extends PropDefBase
                          ? ResolvedPropValue<Item, Prev[Depth]>[]
                          : unknown[]
                      : D extends ObjectPropDef<infer Fields>
                        ? Depth extends 0
                          ? Record<string, unknown>
                          : {
                              [K in keyof Fields]: Fields[K] extends PropDefBase
                                ? ResolvedPropValue<Fields[K], Prev[Depth]>
                                : unknown;
                            }
                        : unknown;

/** The resolved, TS-native prop values a component receives at render time (docs/renderer.md). */
export type ResolvedProps<P extends Record<string, PropDefBase>> = {
  [K in keyof P]: ResolvedPropValue<P[K]>;
};
