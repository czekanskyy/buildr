import { type PanelSide, useShellPanels } from '../app/shell-panels.tsx';
import { type MessageKey, useT } from '../messages/index.tsx';
import { IconButton } from '../ui/index.ts';

const LABELS: Readonly<Record<PanelSide, MessageKey>> = {
  left: 'editor.panels.left',
  right: 'editor.panels.right',
};

/**
 * The button that shows or hides one side panel at every width. Wide: it collapses the panel to its
 * rail (persisted); narrow (PB-122): it opens the panel as an overlay, one at a time. It renders
 * nothing outside the layout (no `ShellPanels`).
 */
export function PanelToggle({ side }: { readonly side: PanelSide }) {
  const t = useT();
  const panels = useShellPanels();
  if (panels === undefined) return null;
  const wide = !panels.narrow;
  if (wide && (panels.collapsed === undefined || panels.toggleCollapsed === undefined)) return null;
  const pressed = wide ? panels.collapsed?.[side] !== true : panels.open[side];
  return (
    <IconButton
      label={t(LABELS[side])}
      icon={side === 'left' ? 'panel-left' : 'panel-right'}
      variant="ghost"
      aria-pressed={pressed}
      onClick={() => (wide ? panels.toggleCollapsed?.(side) : panels.toggle(side))}
    />
  );
}
