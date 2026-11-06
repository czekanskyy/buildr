import type { LengthUnit, StyleGrammar, TokenScale } from './grammar.ts';

export const STYLE_GROUPS = [
  'layout',
  'size',
  'spacing',
  'typography',
  'background',
  'border',
  'effects',
  'motion',
  'visibility',
] as const;
export type StyleGroup = (typeof STYLE_GROUPS)[number];

/** `value`: one value. `box`: per-side (`top/right/bottom/left`). `corners`: per-corner. */
export type StyleShape = 'value' | 'box' | 'corners';

export const BOX_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export const CORNERS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;

/**
 * One entry of the property registry (docs/styles.md#value-grammar-per-property-never-free-form-
 * css). The compiler and the validator both read this single table, so a property that is not
 * here cannot be stored or emitted.
 */
export interface StylePropertyDef {
  readonly group: StyleGroup;
  readonly name: string;
  readonly shape: StyleShape;
  /** The CSS property; for `box`/`corners` the shorthand it is spelled with. */
  readonly cssProperty: string;
  /** For `box`/`corners`: the longhand CSS property of each side/corner. */
  readonly sides?: Readonly<Record<string, string>>;
  readonly grammar: StyleGrammar;
  /** Naturally inherited by CSS; the only case the `inherit` keyword is accepted. */
  readonly inheritable: boolean;
  /** The token scales the grammar accepts, when it accepts tokens. */
  readonly tokenScale?: readonly TokenScale[];
  /** May be set in a pseudo-state (`hover`, `focus-visible`, `active`): visual properties only. */
  readonly allowInStates: boolean;
}

const ABSOLUTE_UNITS: readonly LengthUnit[] = ['px', 'rem', 'em'];
const SIZE_UNITS: readonly LengthUnit[] = ['px', 'rem', 'em', '%', 'vw', 'vh', 'svh', 'dvh', 'ch'];

const enumOf = (...values: string[]): StyleGrammar => ({ kind: 'composite', keywords: values });

export const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
] as const;
export const STYLE_POSITIONS = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top left',
  'top right',
  'bottom left',
  'bottom right',
] as const;
export const GRADIENT_TYPES = ['linear', 'radial'] as const;
export const RADIAL_SHAPES = ['circle', 'ellipse'] as const;
export const BACKGROUND_REPEATS = [
  'repeat',
  'no-repeat',
  'repeat-x',
  'repeat-y',
  'space',
  'round',
] as const;
export const BACKGROUND_ATTACHMENTS = ['scroll', 'fixed', 'local'] as const;

// Motion (ADR-027): every value is an enum or a bounded number, so the compiler can emit fixed CSS.
export const ENTRANCE_EFFECTS = ['none', 'fade', 'slide', 'zoom'] as const;
export const MOTION_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export const MOTION_EASINGS = [
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'linear',
  'snappy',
  'bounce',
] as const;
export const HOVER_EFFECTS = ['none', 'lift', 'grow', 'shrink', 'tilt'] as const;
export const SCROLL_REVEALS = ['none', 'fade', 'slide', 'zoom'] as const;
/** Longest delay or duration of an entrance, in milliseconds. */
export const MAX_MOTION_MS = 5000;
/** Largest parallax travel (each way), in pixels. */
export const MAX_PARALLAX_PX = 200;
const boundedLength = (units: readonly LengthUnit[], min: number, max: number): StyleGrammar => ({
  kind: 'composite',
  length: { units, negative: min < 0, min, max },
});
const boundedNumber = (min: number, max: number): StyleGrammar => ({
  kind: 'composite',
  number: { min, max },
});

const ALIGN = ['flex-start', 'flex-end', 'center', 'start', 'end'] as const;
const spaceOrLength = (negative = false, keywords: string[] = []): StyleGrammar => ({
  kind: 'composite',
  tokens: ['space'],
  keywords,
  length: { units: SIZE_UNITS, negative },
});
const sizeGrammar = (...keywords: string[]): StyleGrammar => ({
  kind: 'composite',
  tokens: ['container', 'space'],
  keywords,
  length: { units: SIZE_UNITS },
});

interface Options {
  readonly inheritable?: boolean;
  readonly states?: boolean;
  readonly shape?: StyleShape;
  readonly sides?: Record<string, string>;
}

function def(
  group: StyleGroup,
  name: string,
  cssProperty: string,
  grammar: StyleGrammar,
  options: Options = {},
): [string, StylePropertyDef] {
  const tokens =
    grammar.kind === 'composite'
      ? grammar.tokens
      : grammar.kind === 'color'
        ? (['color'] as const)
        : undefined;
  return [
    `${group}.${name}`,
    {
      group,
      name,
      shape: options.shape ?? 'value',
      cssProperty,
      ...(options.sides === undefined ? {} : { sides: options.sides }),
      grammar,
      inheritable: options.inheritable ?? false,
      ...(tokens === undefined ? {} : { tokenScale: tokens }),
      allowInStates: options.states ?? false,
    },
  ];
}

const side = (prefix: string, suffix = ''): Record<string, string> =>
  Object.fromEntries(BOX_SIDES.map((s) => [s, `${prefix}-${s}${suffix}`]));

const boxOptions = (prefix: string, suffix = '', states = false): Options => ({
  shape: 'box',
  sides: side(prefix, suffix),
  states,
});

const trackSize = (): StyleGrammar => spaceOrLength(false);

/**
 * Every style property a node may carry, keyed `group.name` (docs/styles.md#model). Adding a
 * property means adding it here (plus its grammar and a test) — nothing else can reach the
 * compiler.
 */
export const stylePropertyRegistry: Readonly<Record<string, StylePropertyDef>> = Object.freeze(
  Object.fromEntries([
    // layout
    def(
      'layout',
      'display',
      'display',
      enumOf(
        'flex',
        'grid',
        'block',
        'inline-flex',
        'inline-grid',
        'inline-block',
        'inline',
        'none',
      ),
    ),
    def(
      'layout',
      'direction',
      'flex-direction',
      enumOf('row', 'column', 'row-reverse', 'column-reverse'),
    ),
    def('layout', 'wrap', 'flex-wrap', enumOf('nowrap', 'wrap', 'wrap-reverse')),
    def(
      'layout',
      'justify',
      'justify-content',
      enumOf(...ALIGN, 'space-between', 'space-around', 'space-evenly', 'stretch'),
    ),
    def('layout', 'align', 'align-items', enumOf(...ALIGN, 'stretch', 'baseline')),
    def('layout', 'alignSelf', 'align-self', enumOf('auto', ...ALIGN, 'stretch', 'baseline')),
    def('layout', 'gap', 'gap', trackSize()),
    def('layout', 'rowGap', 'row-gap', trackSize()),
    def('layout', 'columnGap', 'column-gap', trackSize()),
    def('layout', 'columns', 'grid-template-columns', { kind: 'gridTrack' }),
    def('layout', 'rows', 'grid-template-rows', { kind: 'gridTrack' }),
    def('layout', 'columnSpan', 'grid-column', { kind: 'gridSpan' }),
    def('layout', 'order', 'order', {
      kind: 'composite',
      number: { min: -100, max: 100, integer: true },
    }),
    def(
      'layout',
      'position',
      'position',
      enumOf('static', 'relative', 'absolute', 'fixed', 'sticky'),
    ),
    def('layout', 'inset', 'inset', spaceOrLength(true, ['auto']), {
      shape: 'box',
      sides: { top: 'top', right: 'right', bottom: 'bottom', left: 'left' },
    }),
    def('layout', 'zIndex', 'z-index', {
      kind: 'composite',
      keywords: ['auto'],
      number: { min: -1000, max: 1000, integer: true },
    }),
    def('layout', 'overflow', 'overflow', enumOf('visible', 'hidden', 'auto', 'scroll', 'clip')),
    // size
    def('size', 'width', 'width', sizeGrammar('auto', 'min-content', 'max-content', 'fit-content')),
    def(
      'size',
      'minWidth',
      'min-width',
      sizeGrammar('auto', 'min-content', 'max-content', 'fit-content'),
    ),
    def(
      'size',
      'maxWidth',
      'max-width',
      sizeGrammar('none', 'min-content', 'max-content', 'fit-content'),
    ),
    def(
      'size',
      'height',
      'height',
      sizeGrammar('auto', 'min-content', 'max-content', 'fit-content'),
    ),
    def(
      'size',
      'minHeight',
      'min-height',
      sizeGrammar('auto', 'min-content', 'max-content', 'fit-content'),
    ),
    def(
      'size',
      'maxHeight',
      'max-height',
      sizeGrammar('none', 'min-content', 'max-content', 'fit-content'),
    ),
    def('size', 'aspectRatio', 'aspect-ratio', { kind: 'ratio' }),
    // spacing
    def('spacing', 'margin', 'margin', spaceOrLength(true, ['auto']), boxOptions('margin')),
    def('spacing', 'padding', 'padding', spaceOrLength(false), boxOptions('padding')),
    // typography
    def(
      'typography',
      'fontFamily',
      'font-family',
      { kind: 'composite', tokens: ['fontFamily'] },
      { inheritable: true },
    ),
    def(
      'typography',
      'fontSize',
      'font-size',
      { kind: 'composite', tokens: ['fontSize'], length: { units: ABSOLUTE_UNITS } },
      { inheritable: true },
    ),
    def(
      'typography',
      'fontWeight',
      'font-weight',
      { kind: 'composite', tokens: ['fontWeight'], number: { min: 100, max: 900, integer: true } },
      { inheritable: true },
    ),
    def(
      'typography',
      'lineHeight',
      'line-height',
      {
        kind: 'composite',
        tokens: ['lineHeight'],
        keywords: ['normal'],
        number: { min: 0.5, max: 5 },
        length: { units: ABSOLUTE_UNITS },
      },
      { inheritable: true },
    ),
    def(
      'typography',
      'letterSpacing',
      'letter-spacing',
      {
        kind: 'composite',
        keywords: ['normal'],
        length: { units: ABSOLUTE_UNITS, negative: true },
      },
      { inheritable: true },
    ),
    def(
      'typography',
      'textAlign',
      'text-align',
      enumOf('left', 'center', 'right', 'justify', 'start', 'end'),
      { inheritable: true },
    ),
    def(
      'typography',
      'textTransform',
      'text-transform',
      enumOf('none', 'uppercase', 'lowercase', 'capitalize'),
      { inheritable: true },
    ),
    def('typography', 'fontStyle', 'font-style', enumOf('normal', 'italic'), { inheritable: true }),
    def(
      'typography',
      'textDecoration',
      'text-decoration',
      enumOf('none', 'underline', 'line-through', 'overline'),
      { states: true },
    ),
    def('typography', 'color', 'color', { kind: 'color' }, { inheritable: true, states: true }),
    // background
    def(
      'background',
      'color',
      'background-color',
      { kind: 'color', keywords: ['transparent'] },
      { states: true },
    ),
    def('background', 'gradient', 'background-image', { kind: 'gradient' }, { states: true }),
    def(
      'background',
      'imagePosition',
      'background-position',
      enumOf(
        'center',
        'top',
        'bottom',
        'left',
        'right',
        'top left',
        'top right',
        'bottom left',
        'bottom right',
      ),
      { states: true },
    ),
    def('background', 'imageSize', 'background-size', enumOf('cover', 'contain', 'auto'), {
      states: true,
    }),
    def('background', 'repeat', 'background-repeat', enumOf(...BACKGROUND_REPEATS), {
      states: true,
    }),
    def('background', 'attachment', 'background-attachment', enumOf(...BACKGROUND_ATTACHMENTS), {
      states: true,
    }),
    // border
    def(
      'border',
      'width',
      'border-width',
      { kind: 'composite', length: { units: ABSOLUTE_UNITS } },
      {
        shape: 'box',
        sides: side('border', '-width'),
        states: true,
      },
    ),
    def('border', 'style', 'border-style', enumOf('none', 'solid', 'dashed', 'dotted', 'double'), {
      states: true,
    }),
    def('border', 'color', 'border-color', { kind: 'color' }, { states: true }),
    def(
      'border',
      'radius',
      'border-radius',
      { kind: 'composite', tokens: ['radius'], length: { units: ['px', 'rem', 'em', '%'] } },
      {
        shape: 'corners',
        sides: {
          topLeft: 'border-top-left-radius',
          topRight: 'border-top-right-radius',
          bottomRight: 'border-bottom-right-radius',
          bottomLeft: 'border-bottom-left-radius',
        },
        states: true,
      },
    ),
    def('effects', 'shadowX', 'box-shadow', boundedLength(['px'], -1000, 1000), { states: true }),
    def('effects', 'shadowY', 'box-shadow', boundedLength(['px'], -1000, 1000), { states: true }),
    def('effects', 'shadowBlur', 'box-shadow', boundedLength(['px'], 0, 1000), { states: true }),
    def('effects', 'shadowSpread', 'box-shadow', boundedLength(['px'], -1000, 1000), {
      states: true,
    }),
    def('effects', 'shadowColor', 'box-shadow', { kind: 'color' }, { states: true }),
    def('effects', 'shadowInset', 'box-shadow', enumOf('inset', 'outset'), { states: true }),
    def('effects', 'textShadowX', 'text-shadow', boundedLength(['px'], -1000, 1000), {
      states: true,
    }),
    def('effects', 'textShadowY', 'text-shadow', boundedLength(['px'], -1000, 1000), {
      states: true,
    }),
    def('effects', 'textShadowBlur', 'text-shadow', boundedLength(['px'], 0, 1000), {
      states: true,
    }),
    def('effects', 'textShadowColor', 'text-shadow', { kind: 'color' }, { states: true }),
    def('effects', 'blur', 'filter', boundedLength(['px'], 0, 100), { states: true }),
    def('effects', 'brightness', 'filter', boundedNumber(0, 2), { states: true }),
    def('effects', 'contrast', 'filter', boundedNumber(0, 2), { states: true }),
    def('effects', 'saturate', 'filter', boundedNumber(0, 2), { states: true }),
    def('effects', 'grayscale', 'filter', boundedNumber(0, 1), { states: true }),
    def('effects', 'sepia', 'filter', boundedNumber(0, 1), { states: true }),
    def('effects', 'hueRotate', 'filter', boundedLength(['deg'], -360, 360), { states: true }),
    def('effects', 'invert', 'filter', boundedNumber(0, 1), { states: true }),
    def('effects', 'backdropBlur', 'backdrop-filter', boundedLength(['px'], 0, 100), {
      states: true,
    }),
    def('effects', 'translateX', 'transform', boundedLength(['px', '%', 'rem'], -10000, 10000), {
      states: true,
    }),
    def('effects', 'translateY', 'transform', boundedLength(['px', '%', 'rem'], -10000, 10000), {
      states: true,
    }),
    def('effects', 'rotate', 'transform', boundedLength(['deg'], -360, 360), { states: true }),
    def('effects', 'scale', 'transform', boundedNumber(0, 10), { states: true }),
    def('effects', 'skewX', 'transform', boundedLength(['deg'], -89, 89), { states: true }),
    def('effects', 'skewY', 'transform', boundedLength(['deg'], -89, 89), { states: true }),
    def('effects', 'transformOrigin', 'transform-origin', enumOf(...STYLE_POSITIONS), {
      states: true,
    }),
    def('effects', 'blendMode', 'mix-blend-mode', enumOf(...BLEND_MODES), { states: true }),
    // effects
    def(
      'effects',
      'opacity',
      'opacity',
      { kind: 'composite', number: { min: 0, max: 1 } },
      { states: true },
    ),
    def(
      'effects',
      'shadow',
      'box-shadow',
      { kind: 'composite', tokens: ['shadow'], keywords: ['none'] },
      { states: true },
    ),
    def(
      'effects',
      'transition',
      'transition',
      { kind: 'composite', tokens: ['transition'], keywords: ['none'] },
      { states: true },
    ),
    def(
      'effects',
      'cursor',
      'cursor',
      enumOf(
        'auto',
        'default',
        'pointer',
        'text',
        'move',
        'grab',
        'grabbing',
        'wait',
        'not-allowed',
        'help',
        'crosshair',
        'zoom-in',
        'zoom-out',
      ),
      { inheritable: true, states: true },
    ),
    // motion (ADR-027). Compiled by `compile-motion.ts`; `cssProperty` names the main property.
    def('motion', 'entrance', 'animation-name', enumOf(...ENTRANCE_EFFECTS)),
    def('motion', 'entranceDirection', 'animation-name', enumOf(...MOTION_DIRECTIONS)),
    def(
      'motion',
      'entranceDuration',
      'animation-duration',
      boundedLength(['ms'], 0, MAX_MOTION_MS),
    ),
    def('motion', 'entranceDelay', 'animation-delay', boundedLength(['ms'], 0, MAX_MOTION_MS)),
    def('motion', 'entranceEasing', 'animation-timing-function', enumOf(...MOTION_EASINGS)),
    def('motion', 'hover', 'transition', enumOf(...HOVER_EFFECTS)),
    def('motion', 'hoverDuration', 'transition-duration', boundedLength(['ms'], 0, 2000)),
    def('motion', 'scrollReveal', 'animation-timeline', enumOf(...SCROLL_REVEALS)),
    def(
      'motion',
      'scrollParallax',
      'animation-range',
      boundedLength(['px'], -MAX_PARALLAX_PX, MAX_PARALLAX_PX),
    ),
    // visibility
    def('visibility', 'hidden', 'display', { kind: 'boolean' }),
  ]),
);

/** The registry entry for `group.name`, or `undefined` when there is no such property. */
export function getStyleProperty(group: string, name: string): StylePropertyDef | undefined {
  const key = `${group}.${name}`;
  return Object.hasOwn(stylePropertyRegistry, key) ? stylePropertyRegistry[key] : undefined;
}

/** All registered properties of `group`, in registry order. */
export function propertiesOfGroup(group: StyleGroup): readonly StylePropertyDef[] {
  return Object.values(stylePropertyRegistry).filter((d) => d.group === group);
}
