import { useState } from 'react';
import { useT } from '../messages/index.tsx';
import { Button, Icon, Popover } from '../ui/index.ts';

export type Zoom = 'fit' | number;

/** The zoom levels the menu offers; `host.setZoom` takes the scale as a fraction (1 is 100%). */
export const ZOOM_LEVELS: readonly Zoom[] = ['fit', 0.5, 0.75, 1, 1.25];

export interface ZoomMenuProps {
  readonly zoom: Zoom;
  readonly onChange: (zoom: Zoom) => void;
}

const percent = (zoom: number) => `${Math.round(zoom * 100)}%`;

/** The canvas zoom: Fit, 50, 75, 100 and 125 percent (the host's `setZoom`). */
export function ZoomMenu({ zoom, onChange }: ZoomMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const text = (value: Zoom) => (value === 'fit' ? t('toolbar.zoom.fit') : percent(value));
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      contentClassName="bd-menu-popover"
      label={t('toolbar.zoom')}
      trigger={
        <Button
          variant="ghost"
          className="bd-zoom-trigger bd-tabular"
          aria-label={`${t('toolbar.zoom')}: ${text(zoom)}`}
        >
          <span aria-hidden="true">{text(zoom)}</span>
          <Icon name="chevron-down" />
        </Button>
      }
    >
      <div className="bd-menu-list">
        {ZOOM_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className="bd-menu-item bd-tabular"
            aria-pressed={level === zoom}
            onClick={() => {
              onChange(level);
              setOpen(false);
            }}
          >
            {text(level)}
          </button>
        ))}
      </div>
    </Popover>
  );
}
