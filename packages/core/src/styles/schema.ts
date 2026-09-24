import { z } from 'zod';
import type { BreakpointId, NodeStyles, StyleDecl } from '../document/style-types.ts';
import { parseStyleValue } from './grammar.ts';
import {
  BOX_SIDES,
  CORNERS,
  STYLE_GROUPS,
  type StyleGroup,
  type StylePropertyDef,
  stylePropertyRegistry,
} from './properties.ts';

/** Max breakpoints a node may override. */
export const MAX_STYLE_BREAKPOINTS = 8;
const STATES = ['hover', 'focus-visible', 'active'] as const;
const BREAKPOINT_ID = /^[a-z][a-z0-9-]{0,31}$/;

/** A value checked by the property's grammar; the issue message says what was expected. */
function valueSchema(def: StylePropertyDef): z.ZodType<unknown> {
  return z.unknown().superRefine((value, ctx) => {
    const parsed = parseStyleValue(def.grammar, value, { inheritable: def.inheritable });
    if (!parsed.ok) ctx.addIssue({ code: 'custom', message: parsed.error.message });
  });
}

function propertySchema(def: StylePropertyDef): z.ZodType<unknown> {
  const value = valueSchema(def);
  if (def.shape === 'value') return value;
  const keys = def.shape === 'box' ? BOX_SIDES : CORNERS;
  return z.strictObject(Object.fromEntries(keys.map((key) => [key, value.optional()])));
}

function groupSchema(group: StyleGroup, statesOnly: boolean): z.ZodType<unknown> | undefined {
  const shape: Record<string, z.ZodType<unknown>> = {};
  for (const def of Object.values(stylePropertyRegistry)) {
    if (def.group !== group || (statesOnly && !def.allowInStates)) continue;
    shape[def.name] = propertySchema(def).optional();
  }
  return Object.keys(shape).length === 0 ? undefined : z.strictObject(shape).optional();
}

function declSchema(statesOnly: boolean): z.ZodType<StyleDecl> {
  const shape: Record<string, z.ZodType<unknown>> = {};
  for (const group of STYLE_GROUPS) {
    const schema = groupSchema(group, statesOnly);
    if (schema !== undefined) shape[group] = schema;
  }
  return z.strictObject(shape) as unknown as z.ZodType<StyleDecl>;
}

/** Validates a `StyleDecl`: known groups and properties only, every value through its grammar. */
export const styleDeclSchema: z.ZodType<StyleDecl> = declSchema(false);

/** A `StyleDecl` restricted to the visual properties allowed in a pseudo-state. */
export const stateStyleDeclSchema: z.ZodType<StyleDecl> = declSchema(true);

/**
 * Validates `PageNode.styles` (docs/styles.md#model): `base`, per-breakpoint `bp` overrides
 * (at most `MAX_STYLE_BREAKPOINTS`; whether an id exists in the theme is checked with the theme)
 * and `state` overrides. Unknown keys are errors, so nothing unregistered can be stored.
 */
export const nodeStylesSchema: z.ZodType<NodeStyles> = z.strictObject({
  base: styleDeclSchema.optional(),
  bp: z
    .record(
      z
        .string()
        .regex(
          BREAKPOINT_ID,
          'must be a breakpoint id such as "tablet"',
        ) as z.ZodType<BreakpointId>,
      styleDeclSchema,
    )
    .refine((bp) => Object.keys(bp).length <= MAX_STYLE_BREAKPOINTS, {
      message: `at most ${MAX_STYLE_BREAKPOINTS} breakpoints`,
    })
    .optional(),
  state: z
    .strictObject(
      Object.fromEntries(STATES.map((state) => [state, stateStyleDeclSchema.optional()])),
    )
    .optional(),
}) as unknown as z.ZodType<NodeStyles>;
