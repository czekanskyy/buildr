'use client';

import { useEffect, useReducer, useRef, useState } from 'react';

export interface CarouselEnhancerProps {
  readonly showArrows: boolean;
  readonly showDots: boolean;
  readonly loop: boolean;
  readonly autoplay: boolean;
  readonly interval: number;
  readonly previous: string;
  readonly next: string;
  readonly goTo: string;
  readonly slides: string;
  readonly slideOf: string;
  readonly pause: string;
  readonly play: string;
}
export interface RotationState {
  sticky?: boolean;
  paused: boolean;
  hover: boolean;
  hidden: boolean;
  reduced: boolean;
}
type RotationEvent =
  | { type: 'pause' | 'focus' | 'end' | 'play' }
  | { type: 'autoplay'; value: boolean }
  | { type: 'hover' | 'hidden' | 'reduced'; value: boolean };
/**
 * Pause / keyboard focus / non-loop end -> sticky paused; Play -> clear sticky pause.
 * Autoplay off -> paused; on -> unpaused unless sticky. Reduced motion always gates rotation.
 * Hover / hidden -> temporary gates; pointer focus leaves the rotation button's click in charge.
 * last === 0 -> no rotation and disabled Play; loop Play at the end waits for the next tick.
 */
export function rotationReducer(state: RotationState, event: RotationEvent): RotationState {
  if (event.type === 'autoplay') return { ...state, paused: !event.value || !!state.sticky };
  if (event.type === 'play') return { ...state, paused: false, sticky: false };
  if ('value' in event) return { ...state, [event.type]: event.value };
  return { ...state, paused: true, sticky: true };
}
export const isRotating = (state: RotationState) =>
  !state.paused && !state.hover && !state.hidden && !state.reduced;
const format = (text: string, index: number, total: number) =>
  text.replace('{index}', String(index + 1)).replace('{total}', String(total));

/** Enhances server-rendered siblings; never receives children or renderer functions. */
export function CarouselEnhancer(props: CarouselEnhancerProps) {
  const bar = useRef<HTMLDivElement>(null);
  const navigate = useRef<(index: number) => void>(() => {});
  const currentIndex = useRef(0);
  const checkedInitialFocus = useRef(false);
  const [state, setState] = useState({ index: 0, total: 0, last: 0 });
  const [rotation, dispatch] = useReducer(rotationReducer, {
    paused: !props.autoplay,
    hover: false,
    hidden: true,
    reduced: true,
  });
  const rotating = props.autoplay && isRotating(rotation) && state.last > 0;
  useEffect(() => {
    dispatch({ type: 'autoplay', value: props.autoplay });
  }, [props.autoplay]);
  useEffect(() => {
    const root = bar.current?.parentElement;
    const track = root?.querySelector<HTMLElement>(':scope > .bc-carousel__track');
    if (!root || !track) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => dispatch({ type: 'reduced', value: media.matches });
    const visibility = () => dispatch({ type: 'hidden', value: document.hidden });
    motion();
    visibility();
    dispatch({ type: 'hover', value: root.matches(':hover') });
    const focusVisible = (element: Element) => {
      try {
        return element.matches(':focus-visible');
      } catch {
        return false;
      }
    };
    if (!checkedInitialFocus.current) {
      checkedInitialFocus.current = true;
      if (
        document.activeElement &&
        root.contains(document.activeElement) &&
        focusVisible(document.activeElement)
      )
        dispatch({ type: 'focus' });
    }
    let slides: HTMLElement[] = [];
    let active = 0;
    let last = 0;
    let requested: number | undefined;
    let frame: number | undefined;
    let idleTimer: number | undefined;
    const originals = new Map<HTMLElement, { label: string | null; inert: string | null }>();
    const visible = new Map<Element, boolean>();
    const restore = (slide: HTMLElement) => {
      const old = originals.get(slide);
      if (!old) return;
      for (const [name, value] of [
        ['aria-label', old.label],
        ['inert', old.inert],
      ] as const) {
        if (value === null) slide.removeAttribute(name);
        else slide.setAttribute(name, value);
      }
      originals.delete(slide);
    };
    const inert = () => {
      // IO visibility threshold is 50%; the active slide is the fallback while geometry settles.
      for (const [index, slide] of slides.entries()) {
        if (
          index === active ||
          visible.get(slide) !== false ||
          slide.contains(document.activeElement)
        )
          slide.removeAttribute('inert');
        else slide.setAttribute('inert', '');
      }
    };
    const publish = () => {
      currentIndex.current = requested ?? active;
      inert();
      setState((old) =>
        old.index === currentIndex.current && old.total === slides.length && old.last === last
          ? old
          : { index: currentIndex.current, total: slides.length, last },
      );
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries)
                visible.set(entry.target, entry.isIntersecting && entry.intersectionRatio >= 0.5);
              inert();
            },
            { root: track, threshold: [0, 0.5, 1] },
          );
    const update = () => {
      const next = [...track.querySelectorAll<HTMLElement>('.bc-carousel-slide')].filter(
        (slide) => slide.closest('.bc-carousel__track') === track,
      );
      for (const slide of slides)
        if (!next.includes(slide)) {
          observer?.unobserve(slide);
          visible.delete(slide);
          restore(slide);
        }
      slides = next;
      const rect = track.getBoundingClientRect();
      const width = slides[0]?.getBoundingClientRect().width ?? 0;
      const perView = width > 0 ? Math.max(1, Math.round(rect.width / width)) : 1;
      last = Math.max(0, slides.length - perView);
      if (width > 0) {
        let distance = Infinity;
        slides.forEach((slide, index) => {
          const delta = Math.abs(slide.getBoundingClientRect().left - rect.left);
          if (delta < distance) {
            distance = delta;
            active = index;
          }
        });
      }
      active = Math.min(active, last);
      if (active === requested) requested = undefined;
      slides.forEach((slide, index) => {
        if (!originals.has(slide)) {
          originals.set(slide, {
            label: slide.getAttribute('aria-label'),
            inert: slide.getAttribute('inert'),
          });
          observer?.observe(slide);
        }
        slide.setAttribute('aria-label', format(props.slideOf, index, slides.length));
      });
      publish();
    };
    navigate.current = (index) => {
      active = props.loop
        ? index > last
          ? 0
          : index < 0
            ? last
            : index
        : Math.max(0, Math.min(last, index));
      const slide = slides[active];
      requested = active;
      if (slide)
        track.scrollBy?.({
          left: slide.getBoundingClientRect().left - track.getBoundingClientRect().left,
          behavior: media.matches ? 'instant' : 'smooth',
        });
      if (!props.loop && active === last) dispatch({ type: 'end' });
      publish();
    };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target.closest(
          'input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="listbox"],[role="combobox"],[role="tree"],[role="grid"],[role="tablist"],.bc-carousel',
        ) !== root
      )
        return;
      event.preventDefault();
      navigate.current(currentIndex.current + (event.key === 'ArrowRight' ? 1 : -1));
    };
    const enter = () => dispatch({ type: 'hover', value: true });
    const leave = () => dispatch({ type: 'hover', value: false });
    // Keyboard entry is sticky. Pointer focus on the rotation button leaves its click in charge.
    const focus = (event: FocusEvent) => {
      if (
        !(event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) &&
        event.target instanceof Element &&
        focusVisible(event.target)
      )
        dispatch({ type: 'focus' });
      inert();
    };
    const settle = () => {
      window.clearTimeout(idleTimer);
      idleTimer = undefined;
      requested = undefined;
      update();
    };
    const interrupt = () => {
      if (requested !== undefined) settle();
    };
    const scroll = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(settle, 150);
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        update();
      });
    };
    track.addEventListener('scroll', scroll);
    track.addEventListener('scrollend', settle);
    for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown'])
      track.addEventListener(event, interrupt);
    root.addEventListener('keydown', key);
    root.addEventListener('mouseenter', enter);
    root.addEventListener('mouseleave', leave);
    root.addEventListener('focusin', focus);
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    resize?.observe(track);
    const mutations = new MutationObserver(update);
    mutations.observe(track, { childList: true, subtree: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      for (const slide of originals.keys()) restore(slide);
      observer?.disconnect();
      resize?.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', update);
      track.removeEventListener('scroll', scroll);
      track.removeEventListener('scrollend', settle);
      for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown'])
        track.removeEventListener(event, interrupt);
      window.clearTimeout(idleTimer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      root.removeEventListener('keydown', key);
      root.removeEventListener('mouseenter', enter);
      root.removeEventListener('mouseleave', leave);
      root.removeEventListener('focusin', focus);
      media.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
      navigate.current = () => {};
    };
  }, [props.loop, props.slideOf]);
  useEffect(() => {
    const track = bar.current?.parentElement?.querySelector('.bc-carousel__track');
    const old = track?.getAttribute('aria-live');
    track?.setAttribute('aria-live', rotating ? 'off' : 'polite');
    return () => {
      if (old == null) track?.removeAttribute('aria-live');
      else track?.setAttribute('aria-live', old);
    };
  }, [rotating]);
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(
      () => navigate.current(currentIndex.current + 1),
      Math.max(3000, Math.min(20000, props.interval)),
    );
    return () => window.clearInterval(timer);
  }, [rotating, props.interval]);
  return (
    <div ref={bar} className="bc-carousel__controls" hidden={state.total < 2}>
      {props.autoplay && (
        <button
          type="button"
          disabled={rotation.reduced || state.last === 0}
          onClick={() => {
            if (rotation.paused && !props.loop && currentIndex.current === state.last)
              navigate.current(0);
            dispatch({ type: rotation.paused ? 'play' : 'pause' });
          }}
        >
          {rotation.paused || rotation.reduced || state.last === 0 ? props.play : props.pause}
        </button>
      )}
      {props.showArrows && (
        <>
          <button
            type="button"
            aria-disabled={!props.loop && state.index === 0}
            onClick={() => {
              if (props.loop || currentIndex.current > 0)
                navigate.current(currentIndex.current - 1);
            }}
          >
            {props.previous}
          </button>
          <button
            type="button"
            aria-disabled={!props.loop && state.index === state.last}
            onClick={() => {
              if (props.loop || currentIndex.current < state.last)
                navigate.current(currentIndex.current + 1);
            }}
          >
            {props.next}
          </button>
        </>
      )}
      {props.showDots && (
        // biome-ignore lint/a11y/useSemanticElements: APG navigation group is not a form fieldset.
        <div className="bc-carousel__dots" role="group" aria-label={props.slides}>
          {Array.from({ length: state.total === 0 ? 0 : state.last + 1 }, (_, index) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: Dots represent stable positions, not slide identity.
              key={`slide-${index + 1}`}
              type="button"
              aria-label={format(props.goTo, index, state.total)}
              aria-current={index === state.index ? 'true' : undefined}
              onClick={() => navigate.current(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
