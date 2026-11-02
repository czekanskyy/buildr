import type { Theme } from '@next-buildr/core';
import { useT } from '../../../messages/index.tsx';
import { Button } from '../../../ui/index.ts';

const POSITIONS = [
  'top left',
  'top',
  'top right',
  'left',
  'center',
  'right',
  'bottom left',
  'bottom',
  'bottom right',
] as const;

/** All nine choices are existing background-position grammar keywords. */
export function AlignmentPad(props: {
  readonly value: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly onPick: (value: string) => void;
}) {
  const t = useT();
  const names = [
    t('style.corner.topLeft'),
    t('style.side.top'),
    t('style.corner.topRight'),
    t('style.side.left'),
    t('style.position.center'),
    t('style.side.right'),
    t('style.corner.bottomLeft'),
    t('style.side.bottom'),
    t('style.corner.bottomRight'),
  ];
  return (
    <fieldset className="bd-alignment-pad" aria-label={props.label} disabled={props.disabled}>
      {POSITIONS.map((position, index) => (
        <Button
          key={position}
          aria-label={names[index]}
          title={names[index]}
          aria-pressed={props.value === position}
          disabled={props.disabled}
          onClick={() => props.onPick(position)}
        >
          <span aria-hidden="true" />
        </Button>
      ))}
    </fieldset>
  );
}

/** Presets use the host theme's tokens, never an arbitrary CSS shadow string. */
export function ShadowPresets(props: {
  readonly theme: Theme;
  readonly value: string;
  readonly disabled: boolean;
  readonly onPick: (value: string) => void;
}) {
  const t = useT();
  const presets = [
    'none',
    ...Object.keys(props.theme.tokens.shadow).map((name) => `$shadow.${name}`),
  ];
  return (
    <fieldset
      className="bd-shadow-presets"
      aria-label={t('style.property.effects.shadow')}
      disabled={props.disabled}
    >
      {presets.map((value, index) => (
        <Button
          key={value}
          className="bd-shadow-preset"
          aria-pressed={props.value === value}
          disabled={props.disabled}
          onClick={() => props.onPick(value)}
        >
          <span className="bd-shadow-mini" data-elevation={Math.min(index, 3)} aria-hidden="true" />
          {value === 'none' ? t('style.shadow.none') : value.slice('$shadow.'.length)}
        </Button>
      ))}
    </fieldset>
  );
}
