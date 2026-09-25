import { createContext, useContext } from 'react';

export type PanelSide = 'left' | 'right';

/**
 * The side panels' overlay mode (below 1100px the layout hides them and the toolbar's toggle
 * buttons open one at a time). Provided by `EditorLayout`; without it (a toolbar outside the
 * layout) there is nothing to toggle.
 */
export interface ShellPanels {
  /** The editor is narrower than the overlay breakpoint. */
  readonly narrow: boolean;
  readonly open: Readonly<Record<PanelSide, boolean>>;
  toggle(side: PanelSide): void;
}

export const ShellPanelsContext = createContext<ShellPanels | undefined>(undefined);

export function useShellPanels(): ShellPanels | undefined {
  return useContext(ShellPanelsContext);
}
