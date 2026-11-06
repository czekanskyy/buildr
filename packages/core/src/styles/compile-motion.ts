import type { Diagnostic } from '../result/diagnostic.ts';
import { parseStyleValue } from './grammar.ts';
import { getStyleProperty } from './properties.ts';

// Motion compiles to fixed CSS (ADR-027). Every input is an enum or a bounded number that went
// back through its property grammar, and every emitted string below is a literal from this file or
// one of those validated values. No script is involved: entrance and hover are plain keyframes and
// transitions, scroll motion is `animation-timeline` behind `@supports`, and
// `prefers-reduced-motion: reduce` gets none of it, which is the static, visible state.

interface Animation {
  readonly name: string;
  readonly duration: string;
  readonly easing: string;
  readonly delay: string;
  readonly fill: 'backwards' | 'both';
  readonly timeline: string;
  readonly range: string;
}

interface HoverEffect {
  readonly property: 'translate' | 'scale' | 'rotate';
  readonly value: string;
  readonly duration: string;
}

/** What one `motion` group means, as data; `renderMotion` turns it into rules for a selector. */
export interface MotionPlan {
  /** Time-based entrance first, then scroll-linked animations. */
  readonly animations: readonly Animation[];
  /** `'reset'` only in an override (a breakpoint), where the base hover must be switched off. */
  readonly hover: HoverEffect | 'reset' | undefined;
  readonly parallax: string | undefined;
  /** A breakpoint's motion replaces the base motion as a whole, so it must also reset it. */
  readonly override: boolean;
}

const EASINGS: Readonly<Record<string, string>> = {
  ease: 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  linear: 'linear',
  snappy: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

const SLIDE_OFFSET = '24px';
const SLIDE_FROM: Readonly<Record<string, string>> = {
  up: `0 ${SLIDE_OFFSET}`,
  down: `0 -${SLIDE_OFFSET}`,
  left: `${SLIDE_OFFSET} 0`,
  right: `-${SLIDE_OFFSET} 0`,
};

/** The `@keyframes` bodies, by name. Only the `from` frame is written: the end is the element's own style. */
const KEYFRAMES: Readonly<Record<string, string>> = {
  'b-m-fade': 'from { opacity: 0; }',
  'b-m-zoom': 'from { opacity: 0; scale: 0.92; }',
  'b-m-slide-up': `from { opacity: 0; translate: ${SLIDE_FROM['up']}; }`,
  'b-m-slide-down': `from { opacity: 0; translate: ${SLIDE_FROM['down']}; }`,
  'b-m-slide-left': `from { opacity: 0; translate: ${SLIDE_FROM['left']}; }`,
  'b-m-slide-right': `from { opacity: 0; translate: ${SLIDE_FROM['right']}; }`,
  'b-m-parallax':
    'from { translate: 0 calc(var(--b-parallax) * -1); } to { translate: 0 var(--b-parallax); }',
};

const HOVERS: Readonly<Record<string, Pick<HoverEffect, 'property' | 'value'>>> = {
  lift: { property: 'translate', value: '0 -4px' },
  grow: { property: 'scale', value: '1.05' },
  shrink: { property: 'scale', value: '0.95' },
  tilt: { property: 'rotate', value: '-2deg' },
};

const DEFAULT_DURATION = '600ms';
const DEFAULT_DELAY = '0ms';
const DEFAULT_HOVER_DURATION = '200ms';

function own(object: unknown, key: string): unknown {
  return typeof object === 'object' && object !== null && Object.hasOwn(object, key)
    ? (object as Record<string, unknown>)[key]
    : undefined;
}

/** A zero time is `0` after the grammar; CSS needs a unit there. */
const time = (css: string): string => (css === '0' ? '0ms' : css);

function effectName(effect: string, direction: string): string | undefined {
  if (effect === 'fade') return 'b-m-fade';
  if (effect === 'zoom') return 'b-m-zoom';
  if (effect === 'slide') return `b-m-slide-${direction}`;
  return undefined;
}

/**
 * Validates and reads the `motion` group of one declaration set. A value that fails its grammar is
 * skipped with a diagnostic, like every other style. `override` marks a breakpoint declaration.
 * `undefined` when the group says nothing (or only `none`s, outside an override).
 */
export function planMotion(
  group: unknown,
  where: string,
  override: boolean,
  diagnostics: Diagnostic[],
): MotionPlan | undefined {
  if (typeof group !== 'object' || group === null || Array.isArray(group)) return undefined;

  const read = (name: string): string | undefined => {
    const value = own(group, name);
    if (value === undefined) return undefined;
    const def = getStyleProperty('motion', name);
    if (def === undefined) return undefined;
    const parsed = parseStyleValue(def.grammar, value);
    if (!parsed.ok) {
      diagnostics.push({ ...parsed.error, details: { property: `${where}motion.${name}` } });
      return undefined;
    }
    return String(parsed.value);
  };

  const entrance = read('entrance');
  const direction = read('entranceDirection') ?? 'up';
  const duration = time(read('entranceDuration') ?? DEFAULT_DURATION);
  const delay = time(read('entranceDelay') ?? DEFAULT_DELAY);
  const easing = EASINGS[read('entranceEasing') ?? 'ease-out'] ?? 'ease-out';
  const hover = read('hover');
  const hoverDuration = time(read('hoverDuration') ?? DEFAULT_HOVER_DURATION);
  const reveal = read('scrollReveal');
  const parallax = read('scrollParallax');

  const animations: Animation[] = [];
  const entranceName = entrance === undefined ? undefined : effectName(entrance, direction);
  if (entranceName !== undefined) {
    animations.push({
      name: entranceName,
      duration,
      easing,
      delay,
      fill: 'backwards',
      timeline: 'auto',
      range: 'normal',
    });
  }
  const revealName = reveal === undefined ? undefined : effectName(reveal, 'up');
  if (revealName !== undefined) {
    animations.push({
      name: revealName,
      duration: 'auto',
      easing: 'linear',
      delay: '0s',
      fill: 'both',
      timeline: 'view()',
      range: 'entry 0% entry 60%',
    });
  }
  const parallaxPx =
    parallax === undefined || parallax === '0' || parallax === '0px' ? undefined : parallax;
  if (parallaxPx !== undefined) {
    animations.push({
      name: 'b-m-parallax',
      duration: 'auto',
      easing: 'linear',
      delay: '0s',
      fill: 'both',
      timeline: 'view()',
      range: 'cover 0% cover 100%',
    });
  }

  const hoverBase = hover === undefined ? undefined : HOVERS[hover];
  const hoverEffect: HoverEffect | 'reset' | undefined =
    hoverBase !== undefined
      ? { ...hoverBase, duration: hoverDuration }
      : override && hover !== undefined
        ? 'reset'
        : undefined;

  const touched = animations.length > 0 || hoverEffect !== undefined;
  const anyKey = ['entrance', 'hover', 'scrollReveal', 'scrollParallax'].some(
    (key) => own(group, key) !== undefined,
  );
  if (!touched && !(override && anyKey)) return undefined;
  return { animations, hover: hoverEffect, parallax: parallaxPx, override };
}

/** The `@keyframes` names a plan uses. */
export function motionKeyframeNames(plan: MotionPlan): readonly string[] {
  return plan.animations.map((a) => a.name);
}

/** The `@keyframes` rule for a name from `motionKeyframeNames`. */
export function keyframesRule(name: string): string {
  const body = Object.hasOwn(KEYFRAMES, name) ? KEYFRAMES[name] : undefined;
  return body === undefined ? '' : `@keyframes ${name} { ${body} }`;
}

function animationDeclarations(animations: readonly Animation[], parallax: string | undefined) {
  const list = (pick: (a: Animation) => string): string => animations.map(pick).join(', ');
  const declarations =
    animations.length === 0
      ? ['animation-name: none']
      : [
          `animation-name: ${list((a) => a.name)}`,
          `animation-duration: ${list((a) => a.duration)}`,
          `animation-timing-function: ${list((a) => a.easing)}`,
          `animation-delay: ${list((a) => a.delay)}`,
          `animation-fill-mode: ${list((a) => a.fill)}`,
        ];
  if (parallax !== undefined) declarations.push(`--b-parallax: ${parallax}`);
  return declarations;
}

const REDUCED = '@media (prefers-reduced-motion: no-preference)';
const RESET_HOVER = 'translate: none; scale: none; rotate: none';

/**
 * The rules for one plan under `selector` (`.b-<id>`): everything sits inside
 * `prefers-reduced-motion: no-preference`, so a visitor who asks for less motion gets the static
 * node. Entrance (time-based, `backwards` fill so the finished node is just the base style) is
 * unconditional; scroll motion is added only where `animation-timeline` is supported, and the
 * base state without it is visible, static content.
 */
export function renderMotion(selector: string, plan: MotionPlan): string {
  const inner: string[] = [];
  const timeBased = plan.animations.filter((a) => a.timeline === 'auto');
  const scrollBased = plan.animations.filter((a) => a.timeline !== 'auto');

  if (timeBased.length > 0 || plan.override) {
    inner.push(`  ${selector} { ${animationDeclarations(timeBased, undefined).join('; ')}; }`);
  }
  if (plan.hover !== undefined) {
    if (plan.hover === 'reset') {
      inner.push(`  @media (hover: hover) { ${selector}:hover { ${RESET_HOVER}; } }`);
    } else {
      const { property, value, duration } = plan.hover;
      inner.push(
        `  ${selector} { transition: ${property} ${duration} ease-out; }`,
        `  @media (hover: hover) { ${selector}:hover { ${property}: ${value}; } }`,
      );
    }
  }
  if (scrollBased.length > 0) {
    const declarations = animationDeclarations(plan.animations, plan.parallax);
    declarations.push(
      `animation-timeline: ${plan.animations.map((a) => a.timeline).join(', ')}`,
      `animation-range: ${plan.animations.map((a) => a.range).join(', ')}`,
    );
    inner.push(
      '  @supports (animation-timeline: view()) {',
      `    ${selector} { ${declarations.join('; ')}; }`,
      '  }',
    );
  }
  return `${REDUCED} {\n${inner.join('\n')}\n}`;
}
