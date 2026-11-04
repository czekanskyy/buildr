import { describe, expect, it } from 'vitest';
import { CHIP_GAP, CHIP_HEIGHT, chipText, placeChip } from './chip.ts';
import { OVERLAY_STYLE, OVERLAY_VAR_NAMES, OVERLAY_VARS, PAGE_STYLE } from './palette.ts';

describe('placeChip', () => {
  const base = { boxLeft: 40, chipWidth: 100, viewportWidth: 800 };

  it('sits above the box when there is room', () => {
    expect(placeChip({ ...base, boxTop: 100 })).toEqual({
      placement: 'above',
      offsetY: 0,
      offsetX: -2,
    });
    expect(placeChip({ ...base, boxTop: CHIP_HEIGHT + CHIP_GAP }).placement).toBe('above');
  });

  it('flips inside the box when it would leave the viewport at the top', () => {
    expect(placeChip({ ...base, boxTop: CHIP_HEIGHT + CHIP_GAP - 1 })).toMatchObject({
      placement: 'inside',
      offsetY: 0,
    });
    expect(placeChip({ ...base, boxTop: 0 }).placement).toBe('inside');
  });

  it('stays visible inside a box that starts above the viewport', () => {
    expect(placeChip({ ...base, boxTop: -120 })).toMatchObject({
      placement: 'inside',
      offsetY: 120,
    });
  });

  it('is pulled left when it would run off the right edge, never past the box start', () => {
    expect(
      placeChip({ boxLeft: 750, chipWidth: 100, viewportWidth: 800, boxTop: 100 }).offsetX,
    ).toBe(-50);
    expect(placeChip({ boxLeft: 10, chipWidth: 100, viewportWidth: 50, boxTop: 100 }).offsetX).toBe(
      -10,
    );
  });

  it('never starts left of the viewport, even for a box at its edge', () => {
    expect(placeChip({ ...base, boxLeft: 0, boxTop: 100 }).offsetX).toBe(0);
    expect(placeChip({ ...base, boxLeft: 1, boxTop: 100 }).offsetX).toBe(-1);
    expect(placeChip({ ...base, boxLeft: -30, boxTop: 100 }).offsetX).toBe(30);
    expect(placeChip({ ...base, boxLeft: 0, boxTop: 0 }).offsetX).toBe(0);
  });

  it('leaves room for the drag handle', () => {
    expect(
      placeChip({
        boxLeft: 690,
        chipWidth: 100,
        viewportWidth: 800,
        boxTop: 100,
        reservedRight: 20,
      }).offsetX,
    ).toBe(-10);
  });
});

describe('chipText', () => {
  it('is "Name · tag", and leaves the tag out when it repeats the name', () => {
    expect(chipText('Hero', 'buildr/hero')).toEqual({ name: 'Hero', tag: 'buildr/hero' });
    expect(chipText('buildr/hero', 'buildr/hero')).toEqual({ name: 'buildr/hero' });
    expect(chipText(undefined, 'buildr/hero')).toEqual({ name: 'buildr/hero' });
  });
});

describe('overlay palette', () => {
  it('is a fixed set of namespaced variables', () => {
    expect(OVERLAY_VAR_NAMES).toEqual([
      '--buildr-accent',
      '--buildr-accent-soft',
      '--buildr-accent-text',
      '--buildr-danger',
      '--buildr-danger-soft',
      '--buildr-placeholder-text',
      '--buildr-font',
    ]);
    expect(OVERLAY_VARS['--buildr-accent']).toBe('#3f5ae0');
  });

  it('declares every variable in both stylesheets and uses no colour literal outside them', () => {
    for (const name of OVERLAY_VAR_NAMES) {
      expect(OVERLAY_STYLE).toContain(`${name}:`);
      expect(PAGE_STYLE).toContain(`${name}:`);
    }
    const body = OVERLAY_STYLE.split('\n').slice(2).join('\n');
    expect(body.replace(/#fff\b/g, '')).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
  });

  it('draws the template outlines and pops the chip in, except with reduced motion', () => {
    expect(OVERLAY_STYLE).toContain(
      '.box.selected { outline: 2px solid var(--buildr-accent); outline-offset: 2px; }',
    );
    expect(OVERLAY_STYLE).toContain('.box.hover { outline: 1px solid');
    expect(OVERLAY_STYLE).toContain('.box.hover.container');
    expect(OVERLAY_STYLE).toContain('animation: bd-pop');
    expect(OVERLAY_STYLE).toMatch(
      /prefers-reduced-motion: reduce\) \{ \.label\.pop \{ animation: none/,
    );
  });

  it('never affects layout or pointer events of the page', () => {
    expect(OVERLAY_STYLE).toContain('.layer { position: fixed; inset: 0; pointer-events: none;');
    expect(PAGE_STYLE).not.toMatch(/:root|\bbody\b|\bhtml\b/);
  });
});
