import { p } from '@next-buildr/core';

export const carouselProps = {
  ariaLabel: p.text({ label: 'Accessible name', default: '', localizable: true, bindable: true }),
  showArrows: p.boolean({ label: 'Show arrows', default: true }),
  showDots: p.boolean({ label: 'Show dots', default: true }),
  loop: p.boolean({ label: 'Loop', default: false }),
  autoplay: p.boolean({ label: 'Automatic rotation', default: false }),
  interval: p.number({
    label: 'Interval (ms)',
    default: 5000,
    min: 3000,
    max: 20000,
    step: 500,
    bindable: true,
  }),
  slidesPerView: p.number({
    label: 'Slides per view',
    default: 1,
    min: 1,
    max: 4,
    step: 1,
    bindable: true,
  }),
} as const;

/** Bound numbers bypass schema ranges; never let them produce an unsafe interval or layout. */
export function clampCarouselNumber(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;
}
