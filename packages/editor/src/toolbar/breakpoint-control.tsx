import type { BreakpointConfig } from '../app/config.ts';
import { type MessageKey, useT } from '../messages/index.tsx';
import { Button, Icon, type IconName, Tooltip } from '../ui/index.ts';

const BREAKPOINT_LABELS: Readonly<Record<string, MessageKey>> = {
  desktop: 'toolbar.breakpoint.desktop',
  tablet: 'toolbar.breakpoint.tablet',
  mobile: 'toolbar.breakpoint.mobile',
};

const BREAKPOINT_ICONS: Readonly<Record<string, IconName>> = {
  desktop: 'monitor',
  tablet: 'tablet',
  mobile: 'smartphone',
};

export interface BreakpointControlProps {
  readonly breakpoints: readonly BreakpointConfig[];
  readonly breakpoint: string;
  readonly onChange: (id: string) => void;
}

/** A segmented control: one icon per screen size, the width in the tooltip. */
export function BreakpointControl({ breakpoints, breakpoint, onChange }: BreakpointControlProps) {
  const t = useT();
  return (
    <fieldset className="bd-breakpoints bd-segmented" aria-label={t('toolbar.breakpoints')}>
      {breakpoints.map((item) => {
        const key = BREAKPOINT_LABELS[item.id];
        const label = key === undefined ? item.id : t(key);
        const icon = BREAKPOINT_ICONS[item.id];
        return (
          <Tooltip key={item.id} content={`${label} · ${item.width}px`}>
            <Button
              variant="ghost"
              className="bd-segment"
              aria-pressed={item.id === breakpoint}
              aria-label={label}
              onClick={() => onChange(item.id)}
            >
              {icon === undefined ? label : <Icon name={icon} />}
            </Button>
          </Tooltip>
        );
      })}
    </fieldset>
  );
}
