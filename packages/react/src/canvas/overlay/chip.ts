/** Height of the label chip and of the drag handle, in px. */
export const CHIP_HEIGHT = 20;

export interface ChipInput {
  /** The outlined box, viewport-relative. */
  readonly boxLeft: number;
  readonly boxTop: number;
  readonly chipWidth: number;
  readonly viewportWidth: number;
  /** Width reserved on the right for the drag handle, 0 when there is none. */
  readonly reservedRight?: number;
}

export interface ChipPlacement {
  /** `above`: on the box's top edge, outside it. `inside`: below the top edge, within the box. */
  readonly placement: 'above' | 'inside';
  /** Extra offset down from the box's top edge when `inside` and the box starts above the viewport. */
  readonly offsetY: number;
  /** Offset to the left edge of the box; negative moves the chip left so it stays in the viewport. */
  readonly offsetX: number;
}

/**
 * Where the label chip of a selected node goes: above the box, or inside it when the space above
 * would leave the viewport; pulled left when it would run off the right edge. Pure, so it is
 * tested without a layout engine.
 */
export function placeChip(input: ChipInput): ChipPlacement {
  const { boxLeft, boxTop, chipWidth, viewportWidth } = input;
  const above = boxTop - CHIP_HEIGHT >= 0;
  const overflow = boxLeft + chipWidth + (input.reservedRight ?? 0) - viewportWidth;
  const offsetX = overflow > 0 ? -Math.min(overflow, Math.max(0, boxLeft)) : 0;
  return {
    placement: above ? 'above' : 'inside',
    offsetY: above ? 0 : Math.max(0, -boxTop),
    offsetX,
  };
}
