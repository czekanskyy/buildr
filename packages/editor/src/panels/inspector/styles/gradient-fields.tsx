const STYLE_POSITIONS = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top left',
  'top right',
  'bottom left',
  'bottom right',
] as const;

import { resolveTokenRef, type Theme } from '@next-buildr/core';
import { useT } from '../../../messages/index.tsx';
import { StyleColorInput as ColorInput } from './color-input.tsx';
import { NumberUnitInput } from './number-input.tsx';
import { optionLabel } from './option-label.ts';
import { RangeSlider } from './widgets.tsx';

const SIMPLE_GRADIENT =
  /^linear-gradient\((-?\d+(?:\.\d+)?deg),\s*(#[0-9a-f]{3,8}|\$color\.[a-z0-9-]+)(?: 0%)?,\s*(#[0-9a-f]{3,8}|\$color\.[a-z0-9-]+)(?: 100%)?\)$/i;

/** The template's two-stop editor. More complex existing gradients retain their text editor. */
export function GradientFields(props: {
  readonly value: string;
  readonly theme: Theme;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}) {
  const t = useT();
  const radial =
    /^radial-gradient\((circle|ellipse) at ([a-z ]+),\s*(#[0-9a-f]{3,8}|\$color\.[a-z0-9-]+)(?: 0%)?,\s*(#[0-9a-f]{3,8}|\$color\.[a-z0-9-]+)(?: 100%)?\)$/i.exec(
      props.value,
    );
  const match = SIMPLE_GRADIENT.exec(props.value);
  const names = Object.keys(props.theme.tokens.color);
  if (match === null && radial === null && props.value !== '' && props.value !== 'none')
    return null;
  if (names.length === 0) return null;
  const angle = match?.[1]?.slice(0, -3) ?? '180';
  const start = radial?.[3] ?? match?.[2] ?? `$color.${names[0]}`;
  const end = radial?.[4] ?? match?.[3] ?? `$color.${names[1] ?? names[0]}`;
  const resolve = (value: string) => {
    if (!value.startsWith('$')) return value;
    const token = resolveTokenRef(props.theme, value);
    return token.ok ? token.value.value : undefined;
  };
  const palette = Object.entries(props.theme.tokens.color).map(([label, color]) => ({
    label,
    color,
    value: `$color.${label}`,
  }));
  const write = (a: string, b: string, degrees: string) =>
    props.onChange(
      radial
        ? `radial-gradient(${radial[1]} at ${radial[2]}, ${a}, ${b})`
        : `linear-gradient(${degrees}deg, ${a}, ${b})`,
    );
  return (
    <div className="bd-gradient-fields">
      <label>
        {t('styleField.bg.gradientKind')}
        <select
          className="bd-input"
          disabled={props.disabled}
          value={radial ? 'radial' : 'linear'}
          onChange={(event) =>
            props.onChange(
              event.target.value === 'radial'
                ? `radial-gradient(ellipse at center, ${start}, ${end})`
                : `linear-gradient(${angle}deg, ${start}, ${end})`,
            )
          }
        >
          <option value="linear">{t('styleField.bg.linear')}</option>
          <option value="radial">{t('styleField.bg.radial')}</option>
        </select>
      </label>
      {radial ? (
        <label>
          {t('styleField.bg.position')}
          <select
            className="bd-input"
            value={radial[2]}
            disabled={props.disabled}
            onChange={(event) =>
              props.onChange(
                `radial-gradient(${radial[1]} at ${event.target.value}, ${start}, ${end})`,
              )
            }
          >
            {STYLE_POSITIONS.map((position) => (
              <option key={position} value={position}>
                {optionLabel(position, t)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="bd-gradient-stop">
        <span>{t('style.gradient.start')}</span>
        <ColorInput
          label={t('style.gradient.start')}
          color={resolve(start)}
          palette={palette}
          disabled={props.disabled}
          onColorChange={(color) => write(color, end, angle)}
        />
      </div>
      <div className="bd-gradient-stop">
        <span>{t('style.gradient.end')}</span>
        <ColorInput
          label={t('style.gradient.end')}
          color={resolve(end)}
          palette={palette}
          disabled={props.disabled}
          onColorChange={(color) => write(start, color, angle)}
        />
      </div>
      {!radial ? (
        <div className="bd-gradient-angle">
          <span>{t('style.gradient.angle')}</span>
          <NumberUnitInput
            value={angle}
            units={[]}
            unitLabel={t('style.unit')}
            ariaLabel={t('style.gradient.angle')}
            disabled={props.disabled}
            onValueChange={(value) => write(start, end, value)}
          />
          <RangeSlider
            label={`${t('style.gradient.angle')}: ${t('style.slider')}`}
            min={-360}
            max={360}
            step={1}
            value={Number(angle) || 0}
            unit="°"
            disabled={props.disabled}
            onChange={(value) => write(start, end, value)}
          />
        </div>
      ) : null}
    </div>
  );
}
