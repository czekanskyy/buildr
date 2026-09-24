export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export const rectContains = (rect: Rect, point: Point): boolean =>
  point.x >= rect.left &&
  point.x < rect.left + rect.width &&
  point.y >= rect.top &&
  point.y < rect.top + rect.height;

/**
 * A pointer position in the window (`clientX/Y`) as the canvas sees it: relative to the frame's
 * top-left corner and divided by the zoom the frame is shown at (`scale` 0.5 means the page is drawn
 * at half size). A frame that is not laid out (zero scale) gives `undefined` rather than infinity.
 */
export function toCanvasPoint(client: Point, frame: Rect, scale = 1): Point | undefined {
  if (!(scale > 0) || !Number.isFinite(scale)) return undefined;
  return { x: (client.x - frame.left) / scale, y: (client.y - frame.top) / scale };
}

export interface AutoscrollOptions {
  /** How close to an edge, in pixels, scrolling starts. */
  readonly edge?: number;
  /** Pixels per frame at the very edge. */
  readonly maxSpeed?: number;
}

/**
 * How far to scroll a region this frame while a drag is near its top or bottom edge: 0 in the
 * middle, growing linearly to `maxSpeed` at the edge (and past it, so a pointer that left the
 * region keeps scrolling), negative upwards.
 */
export function autoscrollDelta(
  region: Rect,
  pointerY: number,
  { edge = 48, maxSpeed = 24 }: AutoscrollOptions = {},
): number {
  const fromTop = pointerY - region.top;
  const fromBottom = region.top + region.height - pointerY;
  const zone = Math.min(edge, region.height / 2);
  if (zone <= 0) return 0;
  if (fromTop < zone) return -maxSpeed * Math.min(1, (zone - fromTop) / zone);
  if (fromBottom < zone) return maxSpeed * Math.min(1, (zone - fromBottom) / zone);
  return 0;
}
