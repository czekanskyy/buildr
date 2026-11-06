import { createContext, useContext } from 'react';
import type { LeftPanelTab } from './contracts.ts';

export type PanelSide = 'left' | 'right';

/**
 * The side panels' overlay mode (below 1100px the layout hides them and the toolbar's toggle
 * buttons open one at a time). Provided by `EditorLayout`; without it (a toolbar outside the
 * layout) there is nothing to toggle.
 */
export interface ShellPanels {
  /** The editor is narrower than the overlay breakpoint. */
  readonly narrow: boolean;
  /** The editor is phone or small tablet wide (768px and less): the toolbar and the status bar collapse. */
  readonly compact?: boolean;
  /** The editor is phone wide (480px and less): the toolbar keeps only icons. */
  readonly tight?: boolean;
  readonly open: Readonly<Record<PanelSide, boolean>>;
  toggle(side: PanelSide): void;
  /** Closes the open overlay (`narrow` only). */
  closeOverlay?(): void;
  /** Persisted collapse of each side panel (wide layout). */
  readonly collapsed?: Readonly<Record<PanelSide, boolean>>;
  toggleCollapsed?(side: PanelSide): void;
  collapseAll?(): void;
  expandAll?(): void;
  /** The active tab of the left panel. */
  readonly leftTab?: LeftPanelTab;
  setLeftTab?(tab: LeftPanelTab): void;
}

export const ShellPanelsContext = createContext<ShellPanels | undefined>(undefined);

export function useShellPanels(): ShellPanels | undefined {
  return useContext(ShellPanelsContext);
}
