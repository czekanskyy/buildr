import type { BreakpointConfig } from '../app/config.ts';
import { type MessageKey, useT } from '../messages/index.tsx';
import { useEditorState } from '../store/index.ts';
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
  const styles = useEditorState((state) =>
    state.anchorId === null ? undefined : state.doc.nodes[state.anchorId]?.styles,
  );
  return (
    <fieldset className="bd-breakpoints bd-segmented" aria-label={t('toolbar.breakpoints')}>
      {breakpoints.map((item) => {
        const key = BREAKPOINT_LABELS[item.id];
        const label = key === undefined ? item.id : t(key);
        const icon = BREAKPOINT_ICONS[item.id];
        const override = styles?.bp?.[item.id];
        const hasOverride =
          override !== undefined &&
          Object.values(override).some(
            (group) => group !== undefined && Object.keys(group).length > 0,
          );
        return (
          <Tooltip
            key={item.id}
            content={t('toolbar.device.size')
              .replace('{name}', label)
              .replace('{width}', String(item.width))}
          >
            <Button
              variant="ghost"
              className="bd-segment"
              aria-pressed={item.id === breakpoint}
              aria-label={label}
              aria-description={hasOverride ? t('toolbar.device.override') : undefined}
              data-override={hasOverride}
              onClick={() => onChange(item.id)}
            >
              {icon === undefined ? label : <Icon name={icon} />}
              {hasOverride && <span className="bd-device-override" aria-hidden="true" />}
            </Button>
          </Tooltip>
        );
      })}
    </fieldset>
  );
}
