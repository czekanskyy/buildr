import { useId, useState } from 'react';
import { useT } from '../../../messages/index.tsx';
import {
  Button,
  type ColorInputProps,
  ColorSwatch,
  hexOf,
  Input,
  Popover,
} from '../../../ui/index.ts';

/** The hue (0-360) of a colour written as `hsl(...)` or `#rrggbb`; 0 for anything else. */
function hueOf(color: string | undefined): number {
  const hsl = /^hsl\(\s*(-?\d+(?:\.\d+)?)/i.exec(color?.trim() ?? '');
  if (hsl?.[1] !== undefined) return Math.round(((Number(hsl[1]) % 360) + 360) % 360);
  const hex = hexOf(color);
  if (hex === undefined) return 0;
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map(
    (i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const sector =
    max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return Math.round(sector * 60) % 360;
}

export function StyleColorInput({
  color,
  label,
  disabled,
  onColorChange,
  palette = [],
}: ColorInputProps) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | undefined>();
  // The slider keeps its own position while it is dragged (a grey has no hue to read back).
  const [hue, setHue] = useState<number | undefined>();
  const text = draft ?? color ?? '';
  const expanded =
    color !== undefined && /^#[0-9a-f]{3,4}$/i.test(color)
      ? `#${[...color.slice(1)].map((c) => c + c).join('')}`
      : color;
  const hex = hexOf(expanded?.slice(0, 7)) ?? '#000000';
  const alpha =
    expanded !== undefined && /^#[0-9a-f]{8}$/i.test(expanded)
      ? Math.round((Number.parseInt(expanded.slice(7), 16) / 255) * 100)
      : 100;
  const change = (value: string) => {
    if (disabled === true) return;
    if (!value.startsWith('hsl(')) setHue(undefined);
    onColorChange(value);
  };
  const choose = (value: string) => {
    setDraft(undefined);
    const chosenHex = hexOf(value);
    const suffix =
      expanded !== undefined && /^#[0-9a-f]{8}$/i.test(expanded) ? expanded.slice(7) : '';
    change(chosenHex !== undefined && suffix !== '' ? `${chosenHex}${suffix}` : value);
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={label}
      contentClassName="bd-color-popover"
      trigger={
        <Button className="bd-color-trigger" aria-label={label} disabled={disabled === true}>
          <ColorSwatch color={color} />
        </Button>
      }
    >
      <h4>{t('style.palette.page')}</h4>
      <fieldset className="bd-color-palette" aria-label={t('style.tokens')}>
        {palette.map((entry) => (
          <Button
            key={entry.label}
            className="bd-palette-color"
            aria-label={`${entry.label}: ${entry.color}`}
            title={`${entry.label}: ${entry.color}`}
            aria-pressed={color === entry.color}
            disabled={disabled === true}
            onClick={() => {
              if (entry.value !== undefined) {
                setDraft(undefined);
                change(entry.value);
              } else choose(entry.color);
            }}
          >
            <ColorSwatch color={entry.color} />
          </Button>
        ))}
      </fieldset>
      <h4>{t('style.palette.custom')}</h4>
      <input
        type="range"
        className="bd-style-hue"
        min="0"
        max="360"
        value={hue ?? hueOf(expanded)}
        aria-label={t('style.palette.hue')}
        disabled={disabled}
        onChange={(event) => {
          // One undo step per drag: each write is the same `node.setStyle` property, which coalesces.
          const next = Number(event.target.value);
          setHue(next);
          choose(`hsl(${next} 100% 50%)`);
        }}
      />
      <label className="bd-color-hex" htmlFor={`${id}-hex`}>
        <span>{t('style.color.hex')}</span>
        <Input
          id={`${id}-hex`}
          value={text}
          disabled={disabled === true}
          spellCheck={false}
          aria-invalid={
            draft !== undefined && !/^#[0-9a-f]{3,4}$|^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(text)
          }
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            if (/^#[0-9a-f]{3,4}$|^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) change(value);
          }}
          onBlur={() => setDraft(undefined)}
        />
      </label>
      <label className="bd-color-opacity">
        <span>{t('style.color.alpha')}</span>
        <output>{alpha}%</output>
        <input
          type="range"
          className="bd-range"
          min="0"
          max="100"
          value={alpha}
          disabled={disabled === true || hexOf(expanded?.slice(0, 7)) === undefined}
          onChange={(event) => {
            setDraft(undefined);
            change(
              `${hex}${Math.round((Number(event.target.value) / 100) * 255)
                .toString(16)
                .padStart(2, '0')}`,
            );
          }}
        />
      </label>
      <Button onClick={() => setOpen(false)}>{t('style.palette.done')}</Button>
    </Popover>
  );
}
