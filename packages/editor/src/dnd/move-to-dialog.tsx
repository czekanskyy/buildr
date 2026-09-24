import type { NodeId } from '@buildr/core';
import { useMemo } from 'react';
import { useT } from '../messages/index.tsx';
import { useEditor } from '../store/index.ts';
import { Button, Dialog } from '../ui/index.ts';
import { moveDestinations } from './destinations.ts';
import { useDragEngine } from './react.tsx';

export interface MoveToDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The nodes to move. */
  readonly ids: readonly NodeId[];
}

/**
 * "Move to": the keyboard way to do what dragging does. It lists the places the rules allow (the
 * end of a slot of any node) and moves the nodes there with the same drop the pointer uses.
 */
export function MoveToDialog({ open, onOpenChange, ids }: MoveToDialogProps) {
  const t = useT();
  const store = useEditor();
  const engine = useDragEngine();
  const destinations = useMemo(() => {
    if (!open) return [];
    return moveDestinations(store.getState().doc, store.registry, ids);
  }, [open, store, ids]);

  const label = (id: NodeId) => {
    const node = store.getState().doc.nodes[id];
    return node?.name ?? store.registry.get(node?.type ?? '')?.label ?? node?.type ?? id;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('dnd.moveTo.title')}
      description={t('dnd.moveTo.description')}
    >
      {destinations.length === 0 ? (
        <p className="bd-dnd-empty">{t('dnd.moveTo.none')}</p>
      ) : (
        <ul className="bd-dnd-destinations">
          {destinations.map((destination) => (
            <li key={`${destination.parentId}/${destination.slot}`}>
              <Button
                variant="ghost"
                onClick={() => {
                  const result = engine.drop({ kind: 'nodes', ids }, destination.target);
                  if (result.ok) onOpenChange(false);
                }}
              >
                {t('dnd.moveTo.into')} {label(destination.parentId)}
                {destination.slot === 'default' ? '' : ` › ${destination.slot}`}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
