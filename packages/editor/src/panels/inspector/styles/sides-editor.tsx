import type { EffectiveStyles, StylePropertyDef, Theme } from '@next-buildr/core';
import { type ReactNode, useEffect, useState } from 'react';
import { type MessageKey, useT } from '../../../messages/index.tsx';
import { IconButton, NumberUnitInput } from '../../../ui/index.ts';
import { unitsOf } from './model.ts';
import { TokenPicker } from './token-picker.tsx';
import { useStyleValue } from './use-style-value.ts';

/** One write of a run: a value for a part, or `undefined` to remove that part's value. */
export interface SideWrite {
  readonly part: string;
  readonly value: string | number | undefined;
}

const NUMBER_UNIT = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/;

const pathOf = (def: StylePropertyDef, part: string) => `${def.group}.${def.name}.${part}`;

interface SideFieldProps {
  readonly def: StylePropertyDef;
  readonly part: string;
  readonly label: string;
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly theme: Theme;
  readonly disabled: boolean;
  readonly unit: string;
  readonly onFocus: () => void;
  readonly onError: (part: string, message: string) => void;
  readonly write: (part: string, value: string | number) => void;
  readonly clear: (part: string) => void;
}

/** One side or corner: a small field holding the number; the unit is the row's. */
function SideField(props: SideFieldProps) {
  const { def, part, label, onError } = props;
  const path = pathOf(def, part);
  const field = useStyleValue({
    def,
    path,
    effective: props.effective,
    layer: props.layer,
    theme: props.theme,
    onSet: (value) => props.write(part, value),
    onUnset: () => props.clear(part),
  });
  const { error } = field;
  useEffect(() => onError(part, error), [error, part, onError]);
  return (
    <div
      className="bd-side-field"
      data-path={path}
      data-part={part}
      data-source={field.current?.source ?? 'none'}
    >
      <NumberUnitInput
        compact
        hideUnitMenu
        value={field.shown}
        units={unitsOf(def)}
        unit={props.unit}
        unitLabel=""
        ariaLabel={label}
        disabled={props.disabled}
        invalid={error !== ''}
        placeholder="–"
        onValueChange={field.change}
        onFocus={props.onFocus}
        onBlur={field.blur}
      />
    </div>
  );
}

export interface SidesEditorProps {
  readonly def: StylePropertyDef;
  /** The visible name of the property (`Margin`). */
  readonly label: string;
  /** The sides or corners, in the order they are laid out. */
  readonly parts: readonly string[];
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly theme: Theme;
  readonly disabled: boolean;
  /** `row`: the fields in a row with labels; `ring`: the fields around a box, which holds `children`. */
  readonly layout: 'row' | 'ring';
  /** Runs several writes as one undo step. */
  readonly apply: (writes: readonly SideWrite[]) => void;
  /** Draws the header of the property; what is passed goes before its origin dot and reset button. */
  readonly renderHead: (extras: ReactNode) => ReactNode;
  readonly children?: ReactNode;
}

/**
 * The visual editor of a property that has one value per side or corner (margin, padding, inset,
 * border width, radius). Every side is a field of its own; a link button makes the fields move
 * together (the default while they are equal), one menu picks the unit for all of them, and the
 * token picker fills the linked sides or the one last focused. The `ring` layout draws the fields
 * around a box, so margin and padding can be nested the way the page shows them.
 */
export function SidesEditor(props: SidesEditorProps) {
  const t = useT();
  const { def, label, parts, effective, layer, layout } = props;
  const units = unitsOf(def);
  const currentOf = (part: string): string | undefined => {
    const entry = effective[pathOf(def, part)];
    return entry === undefined ? undefined : String(entry.value);
  };
  const setHere = (part: string) => effective[pathOf(def, part)]?.source === layer;

  const values = parts.map(currentOf);
  const [linked, setLinked] = useState(() => values.every((value) => value === values[0]));
  const [focused, setFocused] = useState<string>(parts[0] as string);
  const [chosenUnit, setChosenUnit] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  // The unit the row shows: the one picked, else the unit of the first value that has one.
  const inValues = values
    .map((value) => (value === undefined ? undefined : NUMBER_UNIT.exec(value)?.[2]))
    .find((unit) => unit !== undefined && units.includes(unit));
  const unit = chosenUnit ?? inValues ?? units[0] ?? '';

  const targets = (part: string) => (linked ? parts : [part]);
  const write = (part: string, value: string | number) =>
    props.apply(targets(part).map((target) => ({ part: target, value })));
  const clear = (part: string) => {
    const writes = targets(part)
      .filter(setHere)
      .map((target) => ({ part: target, value: undefined }));
    if (writes.length > 0) props.apply(writes);
  };
  const changeUnit = (next: string) => {
    setChosenUnit(next);
    const writes: SideWrite[] = [];
    for (const part of parts) {
      const match = setHere(part) ? NUMBER_UNIT.exec(currentOf(part) ?? '') : null;
      if (match !== null) writes.push({ part, value: `${match[1]}${next}` });
    }
    if (writes.length > 0) props.apply(writes);
  };
  const reportError = (part: string, message: string) =>
    setErrors((current) =>
      (current[part] ?? '') === message ? current : { ...current, [part]: message },
    );
  const error = parts.map((part) => errors[part]).find((message) => (message ?? '') !== '');

  const partLabel = (part: string) =>
    def.shape === 'corners'
      ? t(`style.corner.${part}` as MessageKey)
      : t(`style.side.${part}` as MessageKey);

  const extras = (
    <>
      <IconButton
        icon={linked ? 'link-2' : 'unlink-2'}
        className="bd-sides-link"
        label={`${label}: ${t(def.shape === 'corners' ? 'style.link.corners' : 'style.link.sides')}`}
        aria-pressed={linked}
        disabled={props.disabled}
        onClick={() => setLinked(!linked)}
      />
      {units.length > 0 ? (
        <select
          className="bd-unit-select"
          aria-label={`${t('style.unit')}: ${label}`}
          value={unit}
          disabled={props.disabled}
          onChange={(event) => changeUnit(event.target.value)}
        >
          {units.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      ) : null}
      <TokenPicker
        def={def}
        theme={props.theme}
        label={label}
        current={currentOf(focused)}
        disabled={props.disabled}
        onPick={(ref) => write(focused, ref)}
      />
    </>
  );

  const field = (part: string) => (
    <SideField
      key={part}
      def={def}
      part={part}
      label={`${label} ${partLabel(part)}`}
      effective={effective}
      layer={layer}
      theme={props.theme}
      disabled={props.disabled}
      unit={unit}
      onFocus={() => setFocused(part)}
      onError={reportError}
      write={write}
      clear={clear}
    />
  );

  const errorLine =
    error === undefined ? null : (
      <p role="alert" className="bd-style-error">
        {error}
      </p>
    );

  if (layout === 'ring') {
    const [top, right, bottom, left] = parts as [string, string, string, string];
    return (
      <div className="bd-ring" data-property={def.name}>
        {props.renderHead(extras)}
        <div className="bd-ring-grid">
          <div className="bd-ring-top">{field(top)}</div>
          <div className="bd-ring-left">{field(left)}</div>
          <div className="bd-ring-center">
            {props.children ?? <span className="bd-ring-core">{t('style.box.content')}</span>}
          </div>
          <div className="bd-ring-right">{field(right)}</div>
          <div className="bd-ring-bottom">{field(bottom)}</div>
        </div>
        {errorLine}
      </div>
    );
  }

  return (
    <div className="bd-sides" data-property={def.name} data-shape={def.shape}>
      {props.renderHead(extras)}
      <div className="bd-sides-grid">
        {parts.map((part) => (
          <div key={part} className="bd-sides-cell">
            {field(part)}
            <span className="bd-sides-label" aria-hidden="true">
              {partLabel(part)}
            </span>
          </div>
        ))}
      </div>
      {errorLine}
    </div>
  );
}
