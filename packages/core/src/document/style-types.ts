// The shape of `PageNode.styles` (docs/styles.md#model). Defined in `document` (L1) rather than
// `styles` (L2) because `PageNode` needs it and `document` must stay self-contained
// (docs/ai/architecture-rules.md); `styles/model.ts` re-exports these as the public surface.

/**
 * One style value as stored in the document: a design token (`"$space.4"`), a length with a unit
 * (`"16px"`), a keyword (`"auto"`), a strictly parsed color (`"#fff"`, `"oklch(0.7 0.1 200)"`), or
 * a plain number for unitless properties (`opacity`, `zIndex`, ...). Never free-form CSS — see
 * `styles/grammar.ts` for what each property accepts.
 */
export type StyleValue = string | number;

/** Per-side values of a box property (`margin`, `padding`, `inset`, `border.width`). */
export interface Box {
  readonly top?: StyleValue | undefined;
  readonly right?: StyleValue | undefined;
  readonly bottom?: StyleValue | undefined;
  readonly left?: StyleValue | undefined;
}

/** Per-corner values of `border.radius`. */
export interface Corners {
  readonly topLeft?: StyleValue | undefined;
  readonly topRight?: StyleValue | undefined;
  readonly bottomRight?: StyleValue | undefined;
  readonly bottomLeft?: StyleValue | undefined;
}

export interface LayoutStyles {
  readonly display?: StyleValue | undefined;
  readonly direction?: StyleValue | undefined;
  readonly wrap?: StyleValue | undefined;
  readonly justify?: StyleValue | undefined;
  readonly align?: StyleValue | undefined;
  readonly alignSelf?: StyleValue | undefined;
  readonly gap?: StyleValue | undefined;
  readonly rowGap?: StyleValue | undefined;
  readonly columnGap?: StyleValue | undefined;
  readonly columns?: StyleValue | undefined;
  readonly rows?: StyleValue | undefined;
  readonly columnSpan?: StyleValue | undefined;
  readonly order?: StyleValue | undefined;
  readonly position?: StyleValue | undefined;
  readonly inset?: Box | undefined;
  readonly zIndex?: StyleValue | undefined;
  readonly overflow?: StyleValue | undefined;
}

export interface SizeStyles {
  readonly width?: StyleValue | undefined;
  readonly minWidth?: StyleValue | undefined;
  readonly maxWidth?: StyleValue | undefined;
  readonly height?: StyleValue | undefined;
  readonly minHeight?: StyleValue | undefined;
  readonly maxHeight?: StyleValue | undefined;
  readonly aspectRatio?: StyleValue | undefined;
}

export interface SpacingStyles {
  readonly margin?: Box | undefined;
  readonly padding?: Box | undefined;
}

export interface TypographyStyles {
  readonly fontFamily?: StyleValue | undefined;
  readonly fontSize?: StyleValue | undefined;
  readonly fontWeight?: StyleValue | undefined;
  readonly lineHeight?: StyleValue | undefined;
  readonly letterSpacing?: StyleValue | undefined;
  readonly textAlign?: StyleValue | undefined;
  readonly textTransform?: StyleValue | undefined;
  readonly fontStyle?: StyleValue | undefined;
  readonly textDecoration?: StyleValue | undefined;
  readonly color?: StyleValue | undefined;
}

export interface BackgroundStyles {
  readonly color?: StyleValue | undefined;
  readonly gradient?: StyleValue | undefined;
  readonly imagePosition?: StyleValue | undefined;
  readonly imageSize?: StyleValue | undefined;
}

export interface BorderStyles {
  readonly width?: Box | undefined;
  readonly style?: StyleValue | undefined;
  readonly color?: StyleValue | undefined;
  readonly radius?: Corners | undefined;
}

export interface EffectsStyles {
  readonly opacity?: StyleValue | undefined;
  readonly shadow?: StyleValue | undefined;
  readonly transition?: StyleValue | undefined;
  readonly cursor?: StyleValue | undefined;
}

export interface VisibilityStyles {
  /** `display: none` at this breakpoint. */
  readonly hidden?: boolean | undefined;
}

/** A set of style declarations, grouped as the inspector shows them. */
export interface StyleDecl {
  readonly layout?: LayoutStyles | undefined;
  readonly size?: SizeStyles | undefined;
  readonly spacing?: SpacingStyles | undefined;
  readonly typography?: TypographyStyles | undefined;
  readonly background?: BackgroundStyles | undefined;
  readonly border?: BorderStyles | undefined;
  readonly effects?: EffectsStyles | undefined;
  readonly visibility?: VisibilityStyles | undefined;
}

/** A breakpoint identifier from the theme (`'tablet'`, `'mobile'`, ...); the base is desktop. */
export type BreakpointId = string;

export type StyleState = 'hover' | 'focus-visible' | 'active';

/** Instance style overrides of a node (docs/styles.md#model). */
export interface NodeStyles {
  /** Desktop, no media query. */
  readonly base?: StyleDecl | undefined;
  readonly bp?: Readonly<Partial<Record<BreakpointId, StyleDecl>>> | undefined;
  /** Pseudo-state overrides, restricted to visual properties (v0.2). */
  readonly state?: Readonly<Partial<Record<StyleState, StyleDecl>>> | undefined;
}
