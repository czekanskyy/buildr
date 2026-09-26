import { BOX_SIDES, type EffectiveStyles, type StylePropertyDef } from '@next-buildr/core';
import { useState } from 'react';
import { useT } from '../../../messages/index.tsx';

type Side = (typeof BOX_SIDES)[number];

const OPPOSITE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const shortOf = (value: string | number | boolean | undefined): string => {
  if (value === undefined) return '–';
  const text = String(value);
  const token = /^\$[A-Za-z]+\.(.+)$/.exec(text);
  return token?.[1] ?? text.replace(/px$/, '');
};

export interface BoxModelProps {
  readonly def: StylePropertyDef;
  /** The visible name of the property (`Margin`). */
  readonly label: string;
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly disabled: boolean;
  /** Draws the edit field of the chosen side(s); it writes to every side in `sides`. */
  readonly renderEditor: (sides: readonly Side[]) => React.ReactNode;
}

/**
 * The box-model widget for margin and padding: the four sides around a box, each showing its
 * value. Clicking a side chooses it for editing; Alt-click chooses both sides of its axis, and the
 * one field below then writes to both.
 */
export function BoxModel({ def, label, effective, layer, disabled, renderEditor }: BoxModelProps) {
  const t = useT();
  const [sides, setSides] = useState<readonly Side[]>(['top']);
  const choose = (side: Side, both: boolean) =>
    setSides(both ? [side, OPPOSITE[side]].sort() : [side]);
  return (
    <div className="bd-box-model" data-property={def.name}>
      <div className="bd-box-diagram" data-kind={def.name}>
        {BOX_SIDES.map((side) => {
          const current = effective[`${def.group}.${def.name}.${side}`];
          return (
            <button
              key={side}
              type="button"
              className="bd-box-side"
              data-side={side}
              data-source={
                current === undefined ? 'none' : current.source === layer ? 'set' : 'inherited'
              }
              aria-pressed={sides.includes(side)}
              disabled={disabled}
              aria-label={`${label} ${t(`style.side.${side}`)}`}
              onClick={(event) => choose(side, event.altKey)}
            >
              {shortOf(current?.value)}
            </button>
          );
        })}
        <span className="bd-box-inner" aria-hidden="true" />
      </div>
      <p className="bd-field-hint">{t('style.box.hint')}</p>
      <div key={sides.join()} className="bd-box-editor">
        {renderEditor(sides)}
      </div>
    </div>
  );
}
