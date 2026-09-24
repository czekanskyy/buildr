import type { LengthUnit, StyleGrammar, TokenScale } from './grammar.ts';

export const STYLE_GROUPS = [
  'layout',
  'size',
  'spacing',
  'typography',
  'background',
  'border',
  'effects',
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
