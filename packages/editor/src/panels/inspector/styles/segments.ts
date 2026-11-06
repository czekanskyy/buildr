import type { MessageKey } from '../../../messages/index.tsx';
import type { IconName } from '../../../ui/index.ts';

/** One segment: an icon (its name and tooltip are the keyword) or, without an icon, the keyword as text. */
export interface Segment {
  readonly keyword: string;
  readonly icon?: IconName;
  /** Message key of the visible name (tooltip and accessible name) when the keyword is English jargon. */
  readonly labelKey?: MessageKey;
}

/**
 * The properties edited with a row of segments, and the keyword each segment stands for. A
 * keyword of the grammar that has no segment stays reachable through the "other" menu next to
 * the row, so nothing the grammar allows becomes unreachable.
 */
export const SEGMENTED: Readonly<Record<string, readonly Segment[]>> = {
  'layout.display': [
    { keyword: 'block', icon: 'rows-2', labelKey: 'style.display.block' },
    { keyword: 'flex', icon: 'columns-3', labelKey: 'style.display.flex' },
    { keyword: 'grid', icon: 'layout-grid', labelKey: 'style.display.grid' },
    { keyword: 'none', icon: 'eye-off', labelKey: 'style.display.none' },
  ],
  'layout.direction': [
    { keyword: 'row', icon: 'arrow-right' },
    { keyword: 'column', icon: 'arrow-down' },
    { keyword: 'row-reverse', icon: 'arrow-left' },
    { keyword: 'column-reverse', icon: 'arrow-up' },
  ],
  'layout.wrap': [{ keyword: 'nowrap' }, { keyword: 'wrap' }],
  'layout.align': [
    { keyword: 'flex-start', icon: 'align-start-vertical' },
    { keyword: 'center', icon: 'align-center-vertical' },
    { keyword: 'flex-end', icon: 'align-end-vertical' },
    { keyword: 'stretch', icon: 'stretch-vertical' },
  ],
  'layout.justify': [
    { keyword: 'flex-start', icon: 'align-horizontal-justify-start' },
    { keyword: 'center', icon: 'align-horizontal-justify-center' },
    { keyword: 'flex-end', icon: 'align-horizontal-justify-end' },
    { keyword: 'space-between', icon: 'align-horizontal-space-between' },
    { keyword: 'space-around', icon: 'align-horizontal-space-around' },
  ],
  'typography.textAlign': [
    { keyword: 'left', icon: 'text-align-start' },
    { keyword: 'center', icon: 'text-align-center' },
    { keyword: 'right', icon: 'text-align-end' },
    { keyword: 'justify', icon: 'text-align-justify' },
  ],
  'typography.textTransform': [
    { keyword: 'none', icon: 'ban' },
    { keyword: 'uppercase', icon: 'case-upper' },
    { keyword: 'lowercase', icon: 'case-lower' },
    { keyword: 'capitalize', icon: 'case-sensitive' },
  ],
  'typography.fontStyle': [
    { keyword: 'normal', icon: 'type' },
    { keyword: 'italic', icon: 'italic' },
  ],
  'typography.textDecoration': [
    { keyword: 'none', icon: 'ban' },
    { keyword: 'underline', icon: 'underline' },
    { keyword: 'line-through', icon: 'strikethrough' },
  ],
  // The arrow is where the block travels (up = it rises from below).
  'motion.entranceDirection': [
    { keyword: 'up', icon: 'arrow-up', labelKey: 'styleOption.motion.up' },
    { keyword: 'down', icon: 'arrow-down', labelKey: 'styleOption.motion.down' },
    { keyword: 'left', icon: 'arrow-left', labelKey: 'styleOption.motion.left' },
    { keyword: 'right', icon: 'arrow-right', labelKey: 'styleOption.motion.right' },
  ],
};

/**
 * Properties that sit side by side in one row (two columns) instead of one under the other, per
 * group. A pair is only drawn when the component allows both; a missing one is skipped.
 */
export const PAIRS: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  layout: [
    ['rowGap', 'columnGap'],
    ['columns', 'rows'],
    ['order', 'zIndex'],
  ],
  size: [
    ['width', 'height'],
    ['minWidth', 'minHeight'],
    ['maxWidth', 'maxHeight'],
  ],
  typography: [
    ['fontSize', 'fontWeight'],
    ['lineHeight', 'letterSpacing'],
  ],
  background: [['imagePosition', 'imageSize']],
};
