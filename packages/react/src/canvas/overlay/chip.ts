/** Height of the label chip and of the drag handle, in px. */
export const CHIP_HEIGHT = 20;

/** The chip sits this far left of the box edge above the box, to line up with the outline. */
export const CHIP_OUTSET_X = -2;

/** Space between the chip and the box edge: the selection outline's 2px offset and its 2px width. */
export const CHIP_GAP = 4;

/**
 * The chip's text, "Name · tag": the node's name (or its component label) and its type id. The tag
 * is left out when it would only repeat the name.
 */
export function chipText(
  name: string | undefined,
  tag: string | undefined,
): { name: string; tag?: string } {
  const shown = name ?? tag ?? '';
  return tag !== undefined && tag !== shown ? { name: shown, tag } : { name: shown };
}

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
  /**
   * The chip's left edge relative to the box's: -2 above the box (the outline's width), 0 inside it;
   * pulled left when it would run off the right edge, and never left of the viewport's own edge.
   */
  readonly offsetX: number;
}

/**
 * Where the label chip of a selected node goes: above the box, or inside it when the space above
 * would leave the viewport; pulled left when it would run off the right edge. Pure, so it is
 * tested without a layout engine.
 */
export function placeChip(input: ChipInput): ChipPlacement {
  const { boxLeft, boxTop, chipWidth, viewportWidth } = input;
  const above = boxTop - CHIP_HEIGHT - CHIP_GAP >= 0;
  const overflow = boxLeft + chipWidth + (input.reservedRight ?? 0) - viewportWidth;
  const base = above ? CHIP_OUTSET_X : 0;
  const wanted = overflow > 0 ? -Math.min(overflow, Math.max(0, boxLeft)) : base;
  const offsetX = Math.max(wanted, -boxLeft) + 0;
  return {
    placement: above ? 'above' : 'inside',
    offsetY: above ? 0 : Math.max(0, -boxTop),
    offsetX,
  };
}
