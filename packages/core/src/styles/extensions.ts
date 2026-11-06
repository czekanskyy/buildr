import '../document/style-types.ts';

declare module '../document/style-types.ts' {
  interface EffectsStyles {
    readonly shadowX?: StyleValue | undefined;
    readonly shadowY?: StyleValue | undefined;
    readonly shadowBlur?: StyleValue | undefined;
    readonly shadowSpread?: StyleValue | undefined;
    readonly shadowColor?: StyleValue | undefined;
    readonly shadowInset?: StyleValue | undefined;
    readonly textShadowX?: StyleValue | undefined;
    readonly textShadowY?: StyleValue | undefined;
    readonly textShadowBlur?: StyleValue | undefined;
    readonly textShadowColor?: StyleValue | undefined;
    readonly blur?: StyleValue | undefined;
    readonly brightness?: StyleValue | undefined;
    readonly contrast?: StyleValue | undefined;
    readonly saturate?: StyleValue | undefined;
    readonly grayscale?: StyleValue | undefined;
    readonly sepia?: StyleValue | undefined;
    readonly hueRotate?: StyleValue | undefined;
    readonly invert?: StyleValue | undefined;
    readonly backdropBlur?: StyleValue | undefined;
    readonly translateX?: StyleValue | undefined;
    readonly translateY?: StyleValue | undefined;
    readonly rotate?: StyleValue | undefined;
    readonly scale?: StyleValue | undefined;
    readonly skewX?: StyleValue | undefined;
    readonly skewY?: StyleValue | undefined;
    readonly transformOrigin?: StyleValue | undefined;
    readonly blendMode?: StyleValue | undefined;
  }
  interface BackgroundStyles {
    readonly repeat?: StyleValue | undefined;
    readonly attachment?: StyleValue | undefined;
  }
}
