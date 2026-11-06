import { createIndex, type NodeId } from '@next-buildr/core';
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useT } from '../messages/index.tsx';
import { useEditor } from '../store/index.ts';
import { Button, Dialog, Icon, SearchField, SegmentedControl } from '../ui/index.ts';
import { type Destination, moveDestinations } from './destinations.ts';
import { useDragEngine } from './react.tsx';

export interface MoveToDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The nodes to move. */
  readonly ids: readonly NodeId[];
}

type Position = 'start' | 'end';

const keyOf = (destination: Destination) => `${destination.parentId}/${destination.slot}`;

/**
 * "Move to": the keyboard way to do what dragging does. It lists the places the rules allow (a slot
 * of any node, indented like the structure tree), lets the author pick the start or the end of it
 * and moves the nodes there with the same drop the pointer uses.
 */
export function MoveToDialog({ open, onOpenChange, ids }: MoveToDialogProps) {
  const t = useT();
  const store = useEditor();
  const engine = useDragEngine();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | undefined>();
  const [position, setPosition] = useState<Position>('end');
  const destinations = useMemo(() => {
    if (!open) return [];
    return moveDestinations(store.getState().doc, store.registry, ids);
  }, [open, store, ids]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setChosen(undefined);
    setPosition('end');
  }, [open]);

  const label = (id: NodeId) => {
    const node = store.getState().doc.nodes[id];
    return node?.name ?? store.registry.get(node?.type ?? '')?.label ?? node?.type ?? id;
  };
  const depth = (id: NodeId) => {
    const index = createIndex(store.getState().doc);
    let level = 0;
    for (let up = index.parentOf[id]; up !== undefined; up = index.parentOf[up]) level += 1;
    return level;
  };
  const text = (destination: Destination) =>
    `${label(destination.parentId)}${destination.slot === 'default' ? '' : ` › ${destination.slot}`}`;

  const needle = query.trim().toLowerCase();
  const shown = destinations.filter(
    (destination) => needle === '' || text(destination).toLowerCase().includes(needle),
  );
  // Roving tabindex: the chosen row (or the first) is the list's one tab stop.
  const stop = shown.some((d) => keyOf(d) === chosen) ? chosen : shown[0] && keyOf(shown[0]);
  const selected = destinations.find((destination) => keyOf(destination) === chosen);

  const move = (destination: Destination | undefined) => {
    if (destination === undefined) return;
    const target = position === 'start' ? { ...destination.target, index: 0 } : destination.target;
    const result = engine.drop({ kind: 'nodes', ids }, target);
    if (result.ok) onOpenChange(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, destination: Destination) => {
    if (event.key === 'Enter') {
      // Enter only selects; the Move button confirms.
      event.preventDefault();
      setChosen(keyOf(destination));
      return;
    }
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const options = [
      ...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=option]') ??
        []),
    ];
    const next = options[options.indexOf(event.currentTarget) + step];
    next?.focus();
    next?.click();
  };

  const first = ids.length === 1 && ids[0] !== undefined ? ids[0] : undefined;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      icon="corner-left-up"
      title={
        first === undefined
          ? t('dnd.moveTo.title')
          : t('dnd.moveTo.named').replace('{name}', label(first))
      }
      description={t('dnd.moveTo.description')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('dialog.cancel')}</Button>
          <Button
            variant="primary"
            disabled={selected === undefined}
            onClick={() => move(selected)}
          >
            {t('dnd.moveTo.confirm')}
          </Button>
        </>
      }
    >
      {destinations.length === 0 ? (
        <p className="bd-dnd-empty">{t('dnd.moveTo.none')}</p>
      ) : (
        <>
          <SearchField
            value={query}
            onChange={setQuery}
            label={t('dnd.moveTo.searchAria')}
            clearLabel={t('blocks.search.clear')}
            placeholder={t('dnd.moveTo.search')}
          />
          <div className="bd-move-list" role="listbox" aria-label={t('dnd.moveTo.where')}>
            {shown.map((destination) => (
              <button
                key={keyOf(destination)}
                type="button"
                role="option"
                aria-selected={keyOf(destination) === chosen}
                className="bd-move-row"
                tabIndex={keyOf(destination) === stop ? 0 : -1}
                style={{
                  paddingInlineStart: `calc(var(--bd-space-3) + ${depth(destination.parentId)} * var(--bd-space-4))`,
                }}
                onClick={() => setChosen(keyOf(destination))}
                onKeyDown={(event) => onKeyDown(event, destination)}
              >
                <Icon name="layers" />
                <span className="bd-move-row-text">{text(destination)}</span>
              </button>
            ))}
          </div>
          <div className="bd-move-position">
            <span className="bd-move-position-label">{t('dnd.moveTo.position')}</span>
            <SegmentedControl
              className="bd-move-segment"
              label={t('dnd.moveTo.position')}
              value={position}
              onValueChange={(next) => setPosition(next as Position)}
              options={[
                { value: 'start', label: t('dnd.moveTo.start') },
                { value: 'end', label: t('dnd.moveTo.end') },
              ]}
            />
          </div>
        </>
      )}
    </Dialog>
  );
}
