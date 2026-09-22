export type { CommonPropOptions, PropDefBase } from './base.ts';
export type { BooleanOptions, BooleanPropDef } from './boolean.ts';
export { buildBooleanPropDef } from './boolean.ts';
export type { IconOptions, IconPropDef } from './icon.ts';
export { buildIconPropDef } from './icon.ts';
export type { LinkOptions, LinkPropDef } from './link.ts';
export { buildLinkPropDef } from './link.ts';
export type { ListOptions, ListPropDef } from './list.ts';
export { buildListPropDef } from './list.ts';
export type { ListSourceOptions, ListSourcePropDef } from './list-source.ts';
export { buildListSourcePropDef } from './list-source.ts';
export type { MediaOptions, MediaPropDef } from './media.ts';
export { buildMediaPropDef } from './media.ts';
export type { NumberOptions, NumberPropDef } from './number.ts';
export { buildNumberPropDef } from './number.ts';
export type { ObjectOptions, ObjectPropDef } from './object.ts';
export { buildObjectPropDef } from './object.ts';
export type { RichTextOptions, RichTextPropDef } from './rich-text.ts';
export { buildRichTextPropDef } from './rich-text.ts';
export type { SelectOptions, SelectPropDef } from './select.ts';
export { buildSelectPropDef } from './select.ts';
export type { TextOptions, TextPropDef } from './text.ts';
export { buildTextPropDef } from './text.ts';
export type { TextareaOptions, TextareaPropDef } from './textarea.ts';
export { buildTextareaPropDef } from './textarea.ts';

import type { BooleanPropDef } from './boolean.ts';
import type { IconPropDef } from './icon.ts';
import type { LinkPropDef } from './link.ts';
import type { ListPropDef } from './list.ts';
import type { ListSourcePropDef } from './list-source.ts';
import type { MediaPropDef } from './media.ts';
import type { NumberPropDef } from './number.ts';
import type { ObjectPropDef } from './object.ts';
import type { RichTextPropDef } from './rich-text.ts';
import type { SelectPropDef } from './select.ts';
import type { TextPropDef } from './text.ts';
import type { TextareaPropDef } from './textarea.ts';

/** The full `p.*` prop-kind union — the value type of `ComponentMeta.props` (docs/component-registry.md#props-dsl-p). */
export type PropDef =
  | BooleanPropDef
  | IconPropDef
  | LinkPropDef
  | ListPropDef
  | ListSourcePropDef
  | MediaPropDef
  | NumberPropDef
  | ObjectPropDef
  | RichTextPropDef
  | SelectPropDef
  | TextPropDef
  | TextareaPropDef;
