// @vitest-environment jsdom
// biome-ignore-all lint/style/noNonNullAssertion: Test setup guarantees these elements exist.
import { act, StrictMode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  CarouselEnhancer,
  isRotating,
  type RotationState,
  rotationReducer,
} from './enhancer.client.tsx';
import { CarouselView } from './view.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const props = {
  showArrows: true,
  showDots: true,
  autoplay: true,
  loop: false,
  interval: 3000,
  previous: 'Previous',
  next: 'Next',
  goTo: 'Go {index}',
  slides: 'Slides',
  pause: 'Pause',
  play: 'Play',
  slideOf: 'Slide {index} of {total}',
};
let roots: Root[] = [];
let motion: EventTarget & { matches: boolean };
let intersection: IntersectionObserverCallback;
beforeEach(() => {
  vi.useFakeTimers();
  motion = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('matchMedia', () => motion);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersection = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  act(() => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});
function tree(count = 3, loop = false) {
  return (
    <section className="bc-carousel">
      <CarouselEnhancer {...props} loop={loop} />
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Mirrors the focusable native scroll track. */}
      <div className="bc-carousel__track" tabIndex={0}>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Fixed test positions.
          <div className="bc-carousel-slide" key={i}>
            <input aria-label={`Input ${i}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
function mount(count = 3, loop = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  act(() => root.render(<StrictMode>{tree(count, loop)}</StrictMode>));
  const click = (text: string) =>
    act(() => {
      const button = [...host.querySelectorAll('button')].find((b) => b.textContent === text);
      if (!button) return;
      // jsdom lacks pointer modality; model the browser's non-focus-visible pointer focus.
      const matches = button.matches.bind(button);
      button.matches = ((selector: string) =>
        selector === ':focus-visible' ? false : matches(selector)) as typeof button.matches;
      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      button.focus();
      button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      button.click();
      vi.advanceTimersByTime(0);
    });
  return { host, root, click, track: host.querySelector('.bc-carousel__track') as HTMLElement };
}
it('has an explicit transition for every rotation event', () => {
  const running: RotationState = { paused: false, hover: false, hidden: false, reduced: false };
  for (const type of ['pause', 'focus', 'end'] as const) {
    const stopped = rotationReducer(running, { type });
    expect(isRotating(stopped)).toBe(false);
    expect(isRotating(rotationReducer(stopped, { type: 'play' }))).toBe(true);
  }
  for (const type of ['hover', 'hidden', 'reduced'] as const) {
    const stopped = rotationReducer(running, { type, value: true });
    expect(isRotating(stopped)).toBe(false);
    expect(isRotating(rotationReducer(stopped, { type, value: false }))).toBe(true);
    expect(isRotating(rotationReducer({ ...stopped, paused: true }, { type, value: false }))).toBe(
      false,
    );
  }
});
it('navigates arrows, dots, keyboard and wraps only when requested', () => {
  const { host, click, track } = mount(3, true);
  click('Previous');
  expect(host.querySelector('[aria-current]')?.textContent).toBe('3');
  click('Next');
  expect(host.querySelector('[aria-current]')?.textContent).toBe('1');
  click('2');
  expect(host.querySelector('[aria-current]')?.textContent).toBe('2');
  const key = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  act(() => track.dispatchEvent(key));
  expect(key.defaultPrevented).toBe(true);
  expect(host.querySelector('[aria-current]')?.textContent).toBe('3');
  const inputKey = new KeyboardEvent('keydown', {
    key: 'ArrowLeft',
    bubbles: true,
    cancelable: true,
  });
  act(() => host.querySelector('input')?.dispatchEvent(inputKey));
  expect(inputKey.defaultPrevented).toBe(false);
});
it('pauses on hover, focus, hidden tabs, live reduced motion and at the end', () => {
  const { host, click, track } = mount();
  const section = host.querySelector('section')!;
  expect(track.getAttribute('aria-live')).toBe('off');
  act(() => section.dispatchEvent(new MouseEvent('mouseenter')));
  expect(vi.getTimerCount()).toBe(0);
  act(() => section.dispatchEvent(new MouseEvent('mouseleave')));
  expect(vi.getTimerCount()).toBe(1);
  act(() => {
    motion.matches = true;
    motion.dispatchEvent(new Event('change'));
  });
  expect(vi.getTimerCount()).toBe(0);
  act(() => {
    motion.matches = false;
    motion.dispatchEvent(new Event('change'));
  });
  expect(vi.getTimerCount()).toBe(1);
  act(() => host.querySelector('input')?.focus());
  act(() => vi.advanceTimersByTime(0));
  expect(vi.getTimerCount()).toBe(0);
  act(() => host.querySelector('input')?.blur());
  act(() => vi.advanceTimersByTime(0));
  expect(vi.getTimerCount()).toBe(0);
  click('Play');
  expect(vi.getTimerCount()).toBe(1);
  act(() => vi.advanceTimersByTime(6000));
  expect(vi.getTimerCount()).toBe(0);
  expect(track.getAttribute('aria-live')).toBe('polite');
});
it('keeps one slide accessible, protects focus and restores DOM on cleanup in StrictMode', () => {
  const { host, root } = mount();
  const slides = [...host.querySelectorAll<HTMLElement>('.bc-carousel-slide')];
  expect(slides[1]?.getAttribute('aria-label')).toBe('Slide 2 of 3');
  act(() =>
    intersection(
      slides.map((target) => ({
        target,
        isIntersecting: false,
        intersectionRatio: 0,
      })) as unknown as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    ),
  );
  expect(slides.filter((s) => !s.hasAttribute('inert'))).toHaveLength(1);
  act(() => slides[1]?.querySelector('input')?.focus());
  expect(slides[1]?.hasAttribute('inert')).toBe(false);
  act(() => root.unmount());
  roots = roots.filter((r) => r !== root);
  act(() => vi.advanceTimersByTime(0));
  expect(slides.every((s) => !s.hasAttribute('inert') && !s.hasAttribute('aria-label'))).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it.each([0, 1])('handles %i slides without rotation', (count) => {
  mount(count);
  expect(vi.getTimerCount()).toBe(0);
});
it('hydrates identical server markup without recoverable or console errors', async () => {
  const host = document.createElement('div');
  host.innerHTML = renderToString(tree());
  document.body.append(host);
  expect(host.querySelector<HTMLElement>('.bc-carousel__controls')?.hidden).toBe(true);
  const error = vi.spyOn(console, 'error');
  const recover = vi.fn();
  await act(async () => {
    roots.push(hydrateRoot(host, tree(), { onRecoverableError: recover }));
  });
  expect(recover).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

it('preserves a user pause across hover and visibility changes', () => {
  const { host, click } = mount();
  click('Pause');
  const section = host.querySelector('section')!;
  act(() => section.dispatchEvent(new MouseEvent('mouseenter')));
  act(() => section.dispatchEvent(new MouseEvent('mouseleave')));
  const hidden = vi.spyOn(document, 'hidden', 'get');
  hidden.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(vi.getTimerCount()).toBe(0);
  click('Play');
  expect(vi.getTimerCount()).toBe(1);
  hidden.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(vi.getTimerCount()).toBe(0);
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(vi.getTimerCount()).toBe(1);
  hidden.mockRestore();
});
it('never starts with reduced motion already requested', () => {
  motion.matches = true;
  const { track } = mount();
  expect(vi.getTimerCount()).toBe(0);
  expect(track.getAttribute('aria-live')).toBe('polite');
});

it('keyboard entry on the rotation button stops until explicit Play', () => {
  const { host, click, track } = mount();
  const button = host.querySelector<HTMLButtonElement>('button')!;
  // jsdom does not infer keyboard focus visibility for buttons.
  const matches = button.matches.bind(button);
  button.matches = ((selector: string) =>
    selector === ':focus-visible' || matches(selector)) as typeof button.matches;
  act(() => button.focus());
  act(() => vi.advanceTimersByTime(0));
  expect(host.querySelector('button')!.textContent).toBe('Play');
  expect(track.getAttribute('aria-live')).toBe('polite');
  click('Play');
  expect(track.getAttribute('aria-live')).toBe('off');
});

it.each(['hover', 'focus'])('does not rotate with %s already present at mount', (gate) => {
  const host = document.createElement('div');
  host.innerHTML = renderToString(tree());
  document.body.append(host);
  if (gate === 'focus') host.querySelector<HTMLElement>('.bc-carousel__track')!.focus();
  const original = Element.prototype.matches;
  const spy = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
    this: Element,
    selector,
  ) {
    if (selector === ':focus-visible') return gate === 'focus';
    return selector === ':hover' && this.classList.contains('bc-carousel')
      ? gate === 'hover'
      : original.call(this, selector);
  });
  act(() => roots.push(hydrateRoot(host, tree())));
  expect(host.querySelector('.bc-carousel__track')!.getAttribute('aria-live')).toBe('polite');
  spy.mockRestore();
});

it('checks initial focus visibility once, without stopping again on effect reruns', () => {
  const host = document.createElement('div');
  host.innerHTML = renderToString(tree());
  document.body.append(host);
  const track = host.querySelector<HTMLElement>('.bc-carousel__track')!;
  track.focus();
  let visible = false;
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector) {
    return selector === ':focus-visible' ? visible : matches.call(this, selector);
  });
  let root: Root;
  act(() => {
    root = hydrateRoot(host, tree());
    roots.push(root);
  });
  expect(track.getAttribute('aria-live')).toBe('off');
  visible = true;
  act(() => root.render(tree(3, true)));
  expect(track.getAttribute('aria-live')).toBe('off');
});

it.each([
  [1, 99, 3000, '4'],
  [99999, -5, 20000, '1'],
] as const)(
  'clamps bound interval %i and slidesPerView %i in production',
  async (interval, slidesPerView, period, expected) => {
    const view = (
      <CarouselView
        {...({
          props: {
            ariaLabel: 'Bound',
            showArrows: true,
            showDots: true,
            loop: true,
            autoplay: true,
            interval,
            slidesPerView,
          },
          root: { className: 'bc-carousel' },
          env: { mode: 'production', locale: 'en', messages: {} },
          children: (
            <>
              {[1, 2].map((n) => (
                // biome-ignore lint/a11y/useSemanticElements: Mirrors APG slide group markup.
                <div
                  key={n}
                  className="bc-carousel-slide"
                  role="group"
                  aria-roledescription="slide"
                />
              ))}
            </>
          ),
        } as unknown as Parameters<typeof CarouselView>[0])}
      />
    );
    const html = renderToString(view);
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.append(host);
    const section = host.querySelector('section')!;
    const track = section.querySelector('.bc-carousel__track')!;
    expect(track.getAttribute('data-per-view')).toBe(expected);
    // Hydrate the exact production subtree with its resolved values.
    await act(async () => {
      roots.push(hydrateRoot(section.parentElement!, view));
    });
    expect(track.getAttribute('aria-live')).toBe('off');
    act(() => vi.advanceTimersByTime(period - 1));
    expect(host.querySelector('[aria-current]')!.textContent).toBe('1');
    act(() => vi.advanceTimersByTime(1));
    expect(host.querySelector('[aria-current]')!.textContent).toBe('2');
  },
);

it('keeps end navigation focusable and ignores repeated end clicks', () => {
  const { host, click } = mount();
  click('Next');
  click('Next');
  const next = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Next')!;
  expect(next.getAttribute('aria-disabled')).toBe('true');
  expect(next.disabled).toBe(false);
  expect(document.activeElement).toBe(next);
  click('Next');
  expect(host.querySelector('[aria-current]')!.textContent).toBe('3');
});

it.each(['pointerdown', 'wheel', 'touchstart', 'keydown'])(
  'resets pending navigation on track %s',
  (event) => {
    const { host, track, click } = mount(5);
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100 } as DOMRect);
    host.querySelectorAll<HTMLElement>('.bc-carousel-slide').forEach((slide, index) => {
      vi.spyOn(slide, 'getBoundingClientRect').mockReturnValue({
        left: index * 100,
        width: 100,
      } as DOMRect);
    });
    click('Next');
    click('Next');
    click('Next');
    act(() => track.dispatchEvent(new Event(event, { bubbles: true })));
    click('Next');
    expect(host.querySelector('[aria-current]')!.textContent).toBe('2');
  },
);

it.each(['scrollend', 'fallback'])('resynchronizes an unfinished scroll on %s', (end) => {
  const { host, track, click } = mount(5);
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100 } as DOMRect);
  host.querySelectorAll<HTMLElement>('.bc-carousel-slide').forEach((slide, index) => {
    vi.spyOn(slide, 'getBoundingClientRect').mockReturnValue({
      left: index * 100,
      width: 100,
    } as DOMRect);
  });
  click('5');
  act(() => track.dispatchEvent(new Event('scroll')));
  act(() => vi.advanceTimersByTime(16));
  expect(host.querySelector('[aria-current]')!.textContent).toBe('5');
  expect(
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent === 'Next')!
      .getAttribute('aria-disabled'),
  ).toBe('true');
  act(() => {
    if (end === 'scrollend') track.dispatchEvent(new Event('scrollend'));
    else vi.advanceTimersByTime(150);
  });
  expect(host.querySelector('[aria-current]')!.textContent).toBe('1');
  click('Next');
  expect(host.querySelector('[aria-current]')!.textContent).toBe('2');
});

it('only stops rotation when keyboard focus enters from outside', () => {
  const { host, track } = mount();
  // jsdom lacks keyboard modality; focus events and relatedTarget remain native.
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector) {
    return selector === ':focus-visible' || matches.call(this, selector);
  });
  const outside = document.createElement('button');
  document.body.append(outside);
  const play = host.querySelector<HTMLButtonElement>('button')!;
  const next = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Next')!;
  const dot = host.querySelector<HTMLButtonElement>('.bc-carousel__dots button')!;
  const entries: (EventTarget | null)[] = [];
  host.addEventListener('focusin', (event) => entries.push(event.relatedTarget));
  act(() => outside.focus());
  act(() => play.focus());
  expect(entries.at(-1)).toBe(outside);
  expect(track.getAttribute('aria-live')).toBe('polite');
  act(() => play.click());
  for (const target of [next, dot, track]) {
    act(() => target.focus());
    expect(track.getAttribute('aria-live')).toBe('off');
  }
  act(() => outside.focus());
  act(() => next.focus());
  expect(entries.at(-1)).toBe(outside);
  expect(track.getAttribute('aria-live')).toBe('polite');
});

it('preserves requested navigation across coalesced intermediate scroll events', () => {
  const { host, track, click } = mount(5, true);
  const geometry = vi
    .spyOn(track, 'getBoundingClientRect')
    .mockReturnValue({ left: 0, width: 100 } as DOMRect);
  host.querySelectorAll<HTMLElement>('.bc-carousel-slide').forEach((slide, index) => {
    vi.spyOn(slide, 'getBoundingClientRect').mockReturnValue({
      left: index * 100,
      width: 100,
    } as DOMRect);
  });
  click('Next');
  act(() => {
    track.dispatchEvent(new Event('scroll'));
    track.dispatchEvent(new Event('scroll'));
    track.dispatchEvent(new Event('scroll'));
  });
  geometry.mockClear();
  act(() => vi.advanceTimersByTime(16));
  expect(geometry).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[aria-current]')!.textContent).toBe('2');
  click('Next');
  expect(host.querySelector('[aria-current]')!.textContent).toBe('3');
  act(() => track.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  click('Next');
  expect(host.querySelector('[aria-current]')!.textContent).toBe('2');
});

it('handles autoplay changes while preserving sticky stops', () => {
  const { root, click } = mount();
  const rerender = (autoplay: boolean) =>
    act(() =>
      root.render(
        <section className="bc-carousel">
          <CarouselEnhancer {...props} autoplay={autoplay} />
          <div className="bc-carousel__track">
            <div className="bc-carousel-slide" />
            <div className="bc-carousel-slide" />
          </div>
        </section>,
      ),
    );
  rerender(false);
  expect(document.querySelector('.bc-carousel__track')!.getAttribute('aria-live')).toBe('polite');
  rerender(true);
  click('Pause');
  rerender(false);
  rerender(true);
  expect(document.querySelector('.bc-carousel__track')!.getAttribute('aria-live')).toBe('polite');
});

it('does not rotate when all slides fit in the viewport', () => {
  const { host, track } = mount();
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 300 } as DOMRect);
  host.querySelectorAll<HTMLElement>('.bc-carousel-slide').forEach((slide, index) => {
    vi.spyOn(slide, 'getBoundingClientRect').mockReturnValue({
      left: index * 100,
      width: 100,
    } as DOMRect);
  });
  act(() => window.dispatchEvent(new Event('resize')));
  expect(track.getAttribute('aria-live')).toBe('polite');
  expect(host.querySelector('button')!.textContent).toBe('Play');
  expect(host.querySelector('button')!.disabled).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it.each([true, false])('Play at the end restarts only without loop (%s)', (loop) => {
  const { host, click } = mount(3, loop);
  click('3');
  if (loop) click('Pause');
  click('Play');
  expect(host.querySelector('[aria-current]')!.textContent).toBe(loop ? '3' : '1');
  act(() => vi.advanceTimersByTime(3000));
  expect(host.querySelector('[aria-current]')!.textContent).toBe(loop ? '1' : '2');
});
it('updates slide labels and counts after Loop replaces children', async () => {
  const { host, track } = mount();
  const slide = document.createElement('div');
  slide.className = 'bc-carousel-slide';
  await act(async () => {
    track.append(slide);
  });
  expect(slide.getAttribute('aria-label')).toBe('Slide 4 of 4');
  expect(host.querySelectorAll('.bc-carousel__dots button')).toHaveLength(4);
  await act(async () => {
    slide.remove();
  });
  expect(slide.hasAttribute('aria-label')).toBe(false);
});
it('leaves prevented keys and nested widgets alone', () => {
  const { track } = mount();
  const prevented = new KeyboardEvent('keydown', {
    key: 'ArrowRight',
    bubbles: true,
    cancelable: true,
  });
  prevented.preventDefault();
  act(() => track.dispatchEvent(prevented));
  const widget = document.createElement('div');
  widget.setAttribute('role', 'slider');
  track.append(widget);
  const key = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  act(() => widget.dispatchEvent(key));
  expect(key.defaultPrevented).toBe(false);
});
