import type { IconName } from '../../../ui/index.ts';

/**
 * The properties edited with a row of icon segments, and the keyword each segment stands for. A
 * keyword of the grammar that has no segment stays reachable through the "other" menu next to
 * the row, so nothing the grammar allows becomes unreachable.
 */
export const SEGMENTED: Readonly<
  Record<string, readonly { readonly keyword: string; readonly icon: IconName }[]>
> = {
  'layout.direction': [
    { keyword: 'row', icon: 'arrow-right' },
    { keyword: 'column', icon: 'arrow-down' },
    { keyword: 'row-reverse', icon: 'arrow-left' },
    { keyword: 'column-reverse', icon: 'arrow-up' },
  ],
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
};
