import { type PanelSide, useShellPanels } from '../app/shell-panels.tsx';
import { type MessageKey, useT } from '../messages/index.tsx';
import { IconButton } from '../ui/index.ts';

const LABELS: Readonly<Record<PanelSide, MessageKey>> = {
  left: 'editor.panels.left',
  right: 'editor.panels.right',
};

/**
 * The button that opens or closes one side panel while the editor is narrow (PB-122). It renders
 * nothing when the panels sit beside the canvas.
 */
export function PanelToggle({ side }: { readonly side: PanelSide }) {
  const t = useT();
  const panels = useShellPanels();
  if (panels === undefined || !panels.narrow) return null;
  return (
    <IconButton
      label={t(LABELS[side])}
      icon={side === 'left' ? 'panel-left' : 'panel-right'}
      variant="ghost"
      aria-pressed={panels.open[side]}
      onClick={() => panels.toggle(side)}
    />
  );
}
