import './extensions.ts';

export type { CompiledStyles, CompileStylesOptions } from './compile.ts';
export { compileStyles } from './compile.ts';
export { keyframesRule } from './compile-motion.ts';
export type { NodeDeclarations, NodeRules } from './compile-node.ts';
export {
  compileNodeDeclarations,
  compileNodeRules,
  nodeClassName,
  STYLE_STATES,
} from './compile-node.ts';
export type { EffectiveStyles, EffectiveValue, StyleSource } from './effective.ts';
export { effectiveStyle, effectiveStyles, hasOverrides } from './effective.ts';
export type { LengthUnit, ParseOptions, StyleGrammar, TokenScale } from './grammar.ts';
export { LENGTH_UNITS, MAX_STYLE_VALUE_LENGTH, parseStyleValue, TOKEN_SCALES } from './grammar.ts';
export type {
  BackgroundStyles,
  BorderStyles,
  Box,
  BreakpointId,
  Corners,
  EffectsStyles,
  LayoutStyles,
  MotionStyles,
  NodeStyles,
  SizeStyles,
  SpacingStyles,
  StyleDecl,
  StyleState,
  StyleValue,
  TypographyStyles,
  VisibilityStyles,
} from './model.ts';
export type { StyleGroup, StylePropertyDef, StyleShape } from './properties.ts';
export {
  BACKGROUND_ATTACHMENTS,
  BACKGROUND_REPEATS,
  BLEND_MODES,
  BOX_SIDES,
  CORNERS,
  ENTRANCE_EFFECTS,
  GRADIENT_TYPES,
  getStyleProperty,
  HOVER_EFFECTS,
  MAX_MOTION_MS,
  MAX_PARALLAX_PX,
  MOTION_DIRECTIONS,
  MOTION_EASINGS,
  propertiesOfGroup,
  RADIAL_SHAPES,
  SCROLL_REVEALS,
  STYLE_GROUPS,
  STYLE_POSITIONS,
  stylePropertyRegistry,
} from './properties.ts';
export {
  MAX_STYLE_BREAKPOINTS,
  nodeStylesSchema,
  stateStyleDeclSchema,
  styleDeclSchema,
} from './schema.ts';
export type { Breakpoint, Theme, ThemeInput, TokenValues } from './theme.ts';
export { defaultTheme, defineTheme, MAX_TOKENS_PER_SCALE, validateTheme } from './theme.ts';
export type { ResolvedTokenRef } from './tokens.ts';
export { compileTokens, LAYER_ORDER_CSS, resolveTokenRef, tokenVariableName } from './tokens.ts';
