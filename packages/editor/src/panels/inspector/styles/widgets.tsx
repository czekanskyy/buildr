import { resolveTokenRef, type Theme } from '@next-buildr/core';
import { type CSSProperties, type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import { interpolate, useT } from '../../../messages/index.tsx';
import { IconButton, Input } from '../../../ui/index.ts';
import { StyleColorInput as ColorInput } from './color-input.tsx';

// --- radio keyboard navigation ---------------------------------------------------------------------

/**
 * Roving tabindex and arrow keys for a radio group of buttons (WAI-ARIA radio pattern): the checked
 * radio, or the first, is the tab stop; arrows move focus and selection and wrap. With `columns`
 * the group is a grid: Left/Right within a row, Up/Down between rows. Home and End jump to the ends.
 */
function useRadioNav(
  count: number,
  columns: number,
  checked: number,
  select: (index: number) => void,
) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const stop = checked >= 0 ? checked : 0;
  const move = (from: number, event: KeyboardEvent) => {
    const rows = Math.ceil(count / columns);
    const row = Math.floor(from / columns);
    const col = from % columns;
    let next: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
        next = columns === 1 ? (from + 1) % count : row * columns + ((col + 1) % columns);
        break;
      case 'ArrowLeft':
        next =
          columns === 1
            ? (from + count - 1) % count
            : row * columns + ((col + columns - 1) % columns);
        break;
      case 'ArrowDown':
        next = columns === 1 ? (from + 1) % count : ((row + 1) % rows) * columns + col;
        break;
      case 'ArrowUp':
        next =
          columns === 1 ? (from + count - 1) % count : ((row + rows - 1) % rows) * columns + col;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next >= count) return;
    refs.current[next]?.focus();
    select(next);
  };
  return (index: number) => ({
    ref: (element: HTMLButtonElement | null) => {
      refs.current[index] = element;
    },
    tabIndex: index === stop ? 0 : -1,
    onKeyDown: (event: KeyboardEvent) => move(index, event),
  });
}

// --- alignment pad -------------------------------------------------------------------------------

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

const capitalise = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * The 3x3 pad (a radio group) with a caption naming the chosen cell. All nine choices are
 * existing background-position grammar keywords; the caller decides which commands a pick runs.
 */
export function AlignmentPad(props: {
  readonly value: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly onPick: (value: string) => void;
  /** A second line under the caption, saying what the pad does. */
  readonly hint?: string | undefined;
  /** The pad for a vertical layout: the chosen mark is drawn as a bar. */
  readonly column?: boolean;
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
  const chosen = POSITIONS.indexOf(props.value as (typeof POSITIONS)[number]);
  const nav = useRadioNav(POSITIONS.length, 3, chosen, (index) =>
    props.onPick(POSITIONS[index] as (typeof POSITIONS)[number]),
  );
  return (
    <div className="bd-padrow">
      <div
        className={
          props.column === true
            ? 'bd-wpad bd-wpad--col bd-alignment-pad'
            : 'bd-wpad bd-alignment-pad'
        }
        role="radiogroup"
        aria-label={props.label}
      >
        {POSITIONS.map((position, index) => (
          // biome-ignore lint/a11y/useSemanticElements: a pad cell is a button in a radio group, as in the template
          <button
            key={position}
            type="button"
            role="radio"
            aria-checked={chosen === index}
            aria-label={names[index]}
            title={names[index]}
            disabled={props.disabled}
            {...nav(index)}
            onClick={() => props.onPick(position)}
          />
        ))}
      </div>
      <p className="bd-wpad__caption">
        <strong>{chosen < 0 ? '–' : capitalise(names[chosen] as string)}</strong>
        {props.hint}
      </p>
    </div>
  );
}

// --- range slider --------------------------------------------------------------------------------

/**
 * A range input whose value shows in a bubble above the thumb while it is dragged or focused. The
 * fill is the share of the range; it only reports text, which the caller still checks.
 */
export function RangeSlider(props: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly label: string;
  readonly disabled: boolean;
  readonly unit?: string;
  /** What the bubble and the spoken value show for a position; the value and unit by default. */
  readonly format?: (value: number) => string;
  /** The slider rests at a fallback while no value is set: shown dimmed. */
  readonly unset?: boolean;
  readonly onChange: (text: string) => void;
}) {
  const span = props.max - props.min;
  const clamped = Math.min(props.max, Math.max(props.min, props.value));
  const share = span > 0 ? ((clamped - props.min) / span) * 100 : 0;
  const text = props.format?.(props.value) ?? `${props.value}${props.unit ?? ''}`;
  return (
    <div
      className="bd-slider"
      data-unset={props.unset === true ? '' : undefined}
      style={{ '--p': `${share}%` } as CSSProperties}
    >
      <input
        type="range"
        aria-label={props.label}
        aria-valuetext={text}
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <span className="bd-slider__bubble" aria-hidden="true">
        {text}
      </span>
    </div>
  );
}

// --- colour field --------------------------------------------------------------------------------

/** The opacity (0-100) a painted colour carries: 100 for a plain colour, `undefined` for no colour. */
function alphaOf(color: string | undefined): number | undefined {
  const text = color?.trim();
  if (text === undefined || text === '') return undefined;
  if (/^#[0-9a-f]{8}$/i.test(text))
    return Math.round((Number.parseInt(text.slice(7), 16) / 255) * 100);
  if (/^#[0-9a-f]{4}$/i.test(text))
    return Math.round((Number.parseInt(text.slice(4) + text.slice(4), 16) / 255) * 100);
  return 100;
}

/**
 * The colour control: a swatch that opens the palette popover, the colour as text (a hex code or a
 * `$color.name` token), and whatever `trailing` adds (the token picker). The text is the caller's
 * draft; nothing here decides what is valid, so an invalid code never leaves the caller.
 */
export function ColorField(props: {
  readonly id?: string | undefined;
  readonly text: string;
  /** The painted colour of the swatch, resolved from tokens by the caller. */
  readonly swatch: string | undefined;
  readonly theme: Theme;
  /** The name of the swatch button. */
  readonly label: string;
  readonly ariaLabel?: string | undefined;
  readonly disabled: boolean;
  readonly invalid?: boolean;
  readonly describedBy?: string | undefined;
  readonly onText: (text: string) => void;
  readonly onSwatch: (value: string) => void;
  readonly onBlur?: () => void;
  readonly trailing?: ReactNode;
  /** The colour that applies while none is set (the theme's text colour): hinted, never stored. */
  readonly fallback?: { readonly text: string; readonly color: string } | undefined;
}) {
  const t = useT();
  const unset = props.text.trim() === '' && props.fallback !== undefined;
  const alpha = alphaOf(unset ? props.fallback?.color : props.swatch);
  return (
    <span
      className="bd-wcolor"
      data-invalid={props.invalid === true ? '' : undefined}
      data-unset={unset ? '' : undefined}
    >
      <ColorInput
        color={unset ? props.fallback?.color : props.swatch}
        palette={Object.entries(props.theme.tokens.color).map(([name, color]) => ({
          label: name,
          color,
          value: `$color.${name}`,
        }))}
        label={props.label}
        disabled={props.disabled}
        onColorChange={props.onSwatch}
      />
      <Input
        {...(props.id !== undefined ? { id: props.id } : {})}
        className="bd-wcolor__hex"
        value={props.text}
        placeholder={props.fallback?.text ?? t('styleField.color.unset')}
        disabled={props.disabled}
        aria-invalid={props.invalid === true}
        aria-describedby={props.describedBy}
        aria-label={props.ariaLabel}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => props.onText(event.target.value)}
        {...(props.onBlur !== undefined ? { onBlur: props.onBlur } : {})}
      />
      {alpha !== undefined ? <span className="bd-wcolor__alpha">{alpha}%</span> : null}
      {props.trailing}
    </span>
  );
}

// --- reset ---------------------------------------------------------------------------------------

/**
 * The small "restore default" icon of a field that has an override at this layer; an empty slot of
 * the same width otherwise, so the row does not move when the override appears.
 */
export function ResetField(props: {
  readonly label: string;
  readonly changed: boolean;
  readonly disabled: boolean;
  readonly onReset: () => void;
}) {
  const t = useT();
  if (!props.changed) return <span className="bd-reset-slot" aria-hidden="true" />;
  return (
    <IconButton
      icon="rotate-ccw"
      size="sm"
      className="bd-field-reset bd-reset"
      disabled={props.disabled}
      label={interpolate(t('inspector.resetField'), { label: props.label })}
      onClick={props.onReset}
    />
  );
}

// --- shadow --------------------------------------------------------------------------------------

const MAX_LAYERS = 4;
const NEW_LAYER = '0px 4px 12px 0px #00000026';
const LENGTH = /^-?(?:\d+\.?\d*|\.\d+)$/;
/** What a shadow may be painted from: lengths, colours and separators, never a reference. */
const PAINTABLE = /^[-\w\s.,#%()/]+$/;

interface ShadowLayer {
  readonly inset: boolean;
  readonly x: string;
  readonly y: string;
  readonly blur: string;
  readonly spread: string;
  readonly color: string;
}

/** Splits on `separator` outside parentheses. */
function splitOutside(text: string, separator: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === separator && depth === 0) {
      out.push(current.trim());
      current = '';
    } else current += ch;
  }
  out.push(current.trim());
  return out.filter((part) => part !== '');
}

function parseLayer(text: string): ShadowLayer | undefined {
  const words = splitOutside(text, ' ');
  const inset = words[0] === 'inset';
  if (inset) words.shift();
  const color = words.pop();
  if (color === undefined || words.length < 2 || words.length > 4) return undefined;
  return {
    inset,
    x: words[0] as string,
    y: words[1] as string,
    blur: words[2] ?? '0px',
    spread: words[3] ?? '0px',
    color,
  };
}

const formatLayer = (layer: ShadowLayer) =>
  [layer.inset ? 'inset' : '', layer.x, layer.y, layer.blur, layer.spread, layer.color]
    .filter((word) => word !== '')
    .join(' ');

/** The layers of a shadow value, resolving a `$shadow.name` token through the theme. */
export function shadowLayers(theme: Theme, value: string): readonly ShadowLayer[] {
  let text = value.trim();
  if (text.startsWith('$')) {
    const token = resolveTokenRef(theme, text);
    text = token.ok ? String(token.value.value) : '';
  }
  if (text === '' || text === 'none') return [];
  return splitOutside(text, ',')
    .map(parseLayer)
    .filter((layer) => layer !== undefined);
}

const paintOf = (theme: Theme, value: string): string | undefined => {
  const layers = shadowLayers(theme, value);
  const css = layers.map(formatLayer).join(', ');
  return css !== '' && PAINTABLE.test(css) ? css : undefined;
};

/** A length field that keeps what is typed until it is left; only a number is passed on. */
function LengthField(props: {
  readonly value: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly onChange: (length: string) => void;
}) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const match = /^(-?(?:\d+\.?\d*|\.\d+))([a-z]*)$/.exec(props.value);
  const unit = match?.[2] || 'px';
  const shown = draft ?? match?.[1] ?? props.value;
  return (
    <span className="bd-wshadow__len">
      <Input
        value={shown}
        aria-label={props.label}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        disabled={props.disabled}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          if (LENGTH.test(text)) props.onChange(`${text}${unit}`);
        }}
        onBlur={() => setDraft(undefined)}
      />
      <span aria-hidden="true">{unit}</span>
    </span>
  );
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function LayerColor(props: {
  readonly color: string;
  readonly theme: Theme;
  readonly label: string;
  readonly disabled: boolean;
  readonly onChange: (color: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const text = draft ?? props.color;
  const swatch = props.color.startsWith('$')
    ? (() => {
        const token = resolveTokenRef(props.theme, props.color);
        return token.ok ? String(token.value.value) : undefined;
      })()
    : props.color;
  return (
    <ColorField
      text={text}
      swatch={swatch}
      theme={props.theme}
      label={`${props.label}: ${t('style.colorPicker')}`}
      ariaLabel={props.label}
      disabled={props.disabled}
      invalid={draft !== undefined && !HEX.test(draft)}
      onText={(next) => {
        setDraft(next);
        if (HEX.test(next)) props.onChange(next);
      }}
      onSwatch={(next) => {
        setDraft(undefined);
        props.onChange(next);
      }}
      onBlur={() => setDraft(undefined)}
    />
  );
}

/**
 * One card per shadow layer (offset, blur, spread, colour, inset). With `onChange` the cards edit
 * and a remove and an add button appear (up to the four layers the grammar allows); without it the
 * cards only show the layers of the chosen theme token. A theme token is shown through its layers;
 * the first edit writes them out as a custom shadow. The caller checks the text before dispatching.
 */
export function ShadowLayers(props: {
  readonly theme: Theme;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange?: ((value: string) => void) | undefined;
}) {
  const t = useT();
  const layers = shadowLayers(props.theme, props.value);
  const { onChange } = props;
  const locked = props.disabled || onChange === undefined;
  const write = (next: readonly ShadowLayer[]) =>
    onChange?.(next.length === 0 ? 'none' : next.map(formatLayer).join(', '));
  const patch = (index: number, change: Partial<ShadowLayer>) =>
    write(layers.map((layer, at) => (at === index ? { ...layer, ...change } : layer)));
  const add = () => {
    const fresh = parseLayer(NEW_LAYER);
    if (fresh !== undefined) write([...layers, fresh]);
  };
  if (layers.length === 0 && onChange === undefined) return null;
  return (
    <div className="bd-wshadow">
      {layers.map((layer, index) => {
        const key = `${index}`;
        const name = interpolate(t('styleField.shadow.layer'), { n: index + 1 });
        return (
          <fieldset key={key} className="bd-wshadow__card" aria-label={name}>
            <div className="bd-wshadow__head">
              <span className="bd-flabel">{name}</span>
              <label className="bd-wshadow__inset">
                <input
                  type="checkbox"
                  checked={layer.inset}
                  disabled={locked}
                  onChange={(event) => patch(index, { inset: event.target.checked })}
                />
                {t('styleField.shadow.inset')}
              </label>
              {onChange !== undefined ? (
                <IconButton
                  icon="trash-2"
                  size="sm"
                  label={`${t('list.remove')}: ${name}`}
                  disabled={props.disabled}
                  onClick={() => write(layers.filter((_, at) => at !== index))}
                />
              ) : null}
            </div>
            <div className="bd-wshadow__grid">
              {(
                [
                  ['x', 'styleField.shadow.x'],
                  ['y', 'styleField.shadow.y'],
                  ['blur', 'styleField.shadow.blur'],
                  ['spread', 'styleField.shadow.spread'],
                ] as const
              ).map(([part, message]) => (
                <div key={part} className="bd-wshadow__field">
                  <span className="bd-flabel">{t(message)}</span>
                  <LengthField
                    value={layer[part]}
                    label={`${name}: ${t(message)}`}
                    disabled={locked}
                    onChange={(length) => patch(index, { [part]: length })}
                  />
                </div>
              ))}
            </div>
            <div className="bd-wshadow__field">
              <span className="bd-flabel">{t('styleField.shadow.color')}</span>
              <LayerColor
                color={layer.color}
                theme={props.theme}
                label={`${name}: ${t('styleField.shadow.color')}`}
                disabled={locked}
                onChange={(color) => patch(index, { color })}
              />
            </div>
          </fieldset>
        );
      })}
      {onChange !== undefined && layers.length < MAX_LAYERS ? (
        <button
          type="button"
          className="bd-textbtn bd-wshadow__add"
          disabled={props.disabled}
          onClick={add}
        >
          {t('styleField.shadow.add')}
        </button>
      ) : null}
    </div>
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
  const nav = useRadioNav(presets.length, 1, presets.indexOf(props.value), (index) =>
    props.onPick(presets[index] as string),
  );
  return (
    <div
      className="bd-shadow-presets bd-wcards"
      role="radiogroup"
      aria-label={t('styleField.shadow.presets')}
    >
      {presets.map((value, index) => {
        const paint = value === 'none' ? undefined : paintOf(props.theme, value);
        return (
          // biome-ignore lint/a11y/useSemanticElements: a preset card is a button in a radio group, as in the template
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={props.value === value}
            className="bd-shadow-preset bd-wcard"
            disabled={props.disabled}
            {...nav(index)}
            onClick={() => props.onPick(value)}
          >
            <span
              className="bd-shadow-mini"
              data-elevation={Math.min(index, 3)}
              style={paint !== undefined ? { boxShadow: paint } : undefined}
              aria-hidden="true"
            />
            {value === 'none'
              ? t('style.shadow.none')
              : value === '$shadow.sm'
                ? t('styleField.shadow.soft')
                : value === '$shadow.md'
                  ? t('styleField.shadow.medium')
                  : value === '$shadow.lg'
                    ? t('styleField.shadow.strong')
                    : value.slice('$shadow.'.length)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The shadow editor: ready shadows, a live preview, and the layer cards. `onCustom` is given only
 * when the property can store a custom shadow; today it takes theme tokens and `none`, so the
 * cards show the layers of the chosen token and cannot add one.
 */
export function ShadowEditor(props: {
  readonly theme: Theme;
  readonly value: string;
  readonly disabled: boolean;
  readonly onPick: (value: string) => void;
  readonly onCustom?: ((value: string) => void) | undefined;
  /** Draw the layer cards (default). The Style tab edits the geometry with sliders instead. */
  readonly layers?: boolean;
}) {
  const paint = paintOf(props.theme, props.value);
  return (
    <div className="bd-wshadow-editor">
      <ShadowPresets
        theme={props.theme}
        value={props.value}
        disabled={props.disabled}
        onPick={props.onPick}
      />
      <div className="bd-shprev" aria-hidden="true">
        <span style={paint !== undefined ? { boxShadow: paint } : undefined} />
      </div>
      {props.layers === false ? null : (
        <ShadowLayers
          theme={props.theme}
          value={props.value}
          disabled={props.disabled}
          onChange={props.onCustom}
        />
      )}
    </div>
  );
}
