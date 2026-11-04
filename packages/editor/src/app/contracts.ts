import type { NodeId } from '@next-buildr/core';

/** The tabs of the left panel. */
export type LeftPanelTab = 'blocks' | 'structure';
export const LEFT_PANEL_TABS: readonly LeftPanelTab[] = ['blocks', 'structure'];

/** What the Blocks tab lists: single blocks or ready-made patterns. */
export type PaletteMode = 'blocks' | 'patterns';
export const PALETTE_MODES: readonly PaletteMode[] = ['blocks', 'patterns'];

/** The stage (canvas area) that toasts and the issues drawer portal into, and the drawer's state. */
export interface StageSlots {
  readonly stage: HTMLElement | null;
  readonly issuesOpen: boolean;
  setIssuesOpen(open: boolean): void;
}

/** The two actions of the empty-page placeholder. */
export interface EmptyPageActions {
  onAddBlock(): void;
  onPickPattern(): void;
}

/** The device keys of the UI-only shortcuts, in toolbar order (desktop, tablet, phone). */
export const DEVICE_SHORTCUT_KEYS = ['1', '2', '3'] as const;
export type DeviceShortcutKey = (typeof DEVICE_SHORTCUT_KEYS)[number];

/** Callbacks of the shortcuts that change only the editor's UI, never the document. */
export interface ShortcutCallbacks {
  /** Keys 1, 2, 3: switch the screen size. */
  setDevice(key: DeviceShortcutKey): void;
  /** Toggle both side panels. */
  togglePanels(): void;
  /** Toggle the block outlines. */
  toggleGuides(): void;
  /** Open the shortcuts dialog (?). */
  openShortcuts(): void;
  /** Focus the block search (/). */
  focusBlockSearch(): void;
}

/** A pending removal that may need a confirmation: ids to remove and whether any has descendants. */
export interface RemoveRequest {
  readonly ids: readonly NodeId[];
  readonly hasDescendants: boolean;
}
